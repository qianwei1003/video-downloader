import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getLogger } from '../utils/logger.js';
import { DownloadTask, TaskStatus, Config } from '../types/index.js';
import ytdl from 'ytdl-core';

export class DownloadService {
  private tasks: Map<string, DownloadTask>;
  private config: Config;
  private logger = getLogger();
  private activeDownloads: number = 0;
  private queue: DownloadTask[] = [];

  constructor(config: Config) {
    this.config = config;
    this.tasks = new Map<string, DownloadTask>();
    
    // 确保下载目录存在
    if (!fs.existsSync(config.download.outputDirectory)) {
      fs.mkdirSync(config.download.outputDirectory, { recursive: true });
    }
  }

  /**
   * 创建新的下载任务
   */
  public async createTask(url: string): Promise<DownloadTask> {
    const id = uuidv4();
    
    const task: DownloadTask = {
      id,
      url,
      status: TaskStatus.PENDING,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.tasks.set(id, task);
    this.logger.info(`创建下载任务: ${id} 用于 ${url}`);

    // 对于YouTube视频，尝试获取标题
    try {
      if (ytdl.validateURL(url)) {
        const info = await ytdl.getBasicInfo(url);
        task.title = info.videoDetails.title;
        this.updateTask(id, { title: task.title });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.warn(`无法获取视频信息: ${errorMessage}`);
    }

    // 将任务加入队列
    this.queue.push(task);
    this.processQueue();
    
    return task;
  }

  /**
   * 获取所有下载任务
   */
  public getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取指定下载任务
   */
  public getTask(id: string): DownloadTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * 取消下载任务
   */
  public cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) {
      return false;
    }

    // 如果任务已经完成或已经失败，无法取消
    if (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) {
      return false;
    }

    // 更新任务状态
    this.updateTask(id, { status: TaskStatus.CANCELED });
    this.logger.info(`取消下载任务: ${id}`);

    // 如果任务正在队列中等待，从队列中移除
    this.queue = this.queue.filter(t => t.id !== id);

    return true;
  }

  /**
   * 处理下载队列
   */
  private processQueue(): void {
    while (this.activeDownloads < this.config.download.concurrentDownloads && this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        this.startDownload(task);
      }
    }
  }

  /**
   * 开始下载任务
   */
  private async startDownload(task: DownloadTask): Promise<void> {
    this.activeDownloads++;
    this.updateTask(task.id, { status: TaskStatus.DOWNLOADING });

    try {
      // 根据URL类型选择不同的下载方法
      if (ytdl.validateURL(task.url)) {
        await this.downloadYouTube(task);
      } else {
        throw new Error('不支持的URL类型');
      }
      
      this.updateTask(task.id, { 
        status: TaskStatus.COMPLETED,
        progress: 100
      });
      this.logger.info(`下载完成: ${task.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.updateTask(task.id, { 
        status: TaskStatus.FAILED,
        error: errorMessage
      });
      this.logger.error(`下载失败: ${task.id} - ${errorMessage}`);
    } finally {
      this.activeDownloads--;
      this.processQueue();
    }
  }

  /**
   * 下载YouTube视频
   */
  private async downloadYouTube(task: DownloadTask): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const videoStream = ytdl(task.url, { quality: 'highest' });
        
        let totalBytes = 0;
        let downloadedBytes = 0;

        videoStream.once('response', (res) => {
          totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        });

        videoStream.on('progress', (_, downloaded, total) => {
          downloadedBytes = downloaded;
          if (total > 0) {
            const progress = Math.floor((downloaded / total) * 100);
            this.updateTask(task.id, { progress });
          }
        });

        // 确定输出文件名
        const filename = `${task.title || task.id}.mp4`;
        const sanitizedFilename = filename.replace(/[/\\?%*:|"<>]/g, '-');
        const outputPath = path.join(this.config.download.outputDirectory, sanitizedFilename);
        
        // 更新任务的输出路径
        this.updateTask(task.id, { outputPath });
        
        const fileStream = fs.createWriteStream(outputPath);
        
        videoStream.pipe(fileStream);
        
        fileStream.on('finish', () => {
          resolve();
        });
        
        fileStream.on('error', (err) => {
          reject(err);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 更新任务信息
   */
  private updateTask(id: string, updates: Partial<DownloadTask>): void {
    const task = this.tasks.get(id);
    if (!task) {
      return;
    }
    
    Object.assign(task, { ...updates, updatedAt: new Date() });
    this.tasks.set(id, task);
  }
}
