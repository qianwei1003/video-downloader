import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { getLogger } from '../utils/logger.js';
import { DownloadTask, TaskStatus, Config } from '../types/index.js';
import ytdl from 'ytdl-core';
import axios from 'axios';

export class DownloadService {
  private tasks: Map<string, DownloadTask>;
  private config: Config;
  private logger = getLogger();
  private activeDownloads: number = 0;
  private queue: DownloadTask[] = [];
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 5000; // 5秒后重试
  private totalProgress: number = 0;
  private batchSize: number = 0;

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
    
    let retries = 0;
    while (retries <= this.maxRetries) {
      try {
      // 根据URL类型选择不同的下载方法
      if (ytdl.validateURL(task.url)) {
        await this.downloadYouTube(task);
      } else if (task.url.includes('douyin.com')) {
        await this.downloadDouyin(task);
      } else if (task.url.includes('bilibili.com')) {
        await this.downloadBilibili(task);
      } else {
        throw new Error('不支持的URL类型');
      }
      
        this.updateTask(task.id, { 
          status: TaskStatus.COMPLETED,
          progress: 100
        });
        this.logger.info(`下载完成: ${task.id}`);
        break; // 下载成功，跳出重试循环
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        
        if (retries < this.maxRetries) {
          retries++;
          this.logger.warn(`下载失败，第 ${retries} 次重试: ${task.id} - ${errorMessage}`);
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          continue;
        }
        
        this.updateTask(task.id, { 
          status: TaskStatus.FAILED,
          error: errorMessage,
          retryCount: retries
        });
        this.logger.error(`下载失败(已重试${retries}次): ${task.id} - ${errorMessage}`);
        break;
      }
    }
    
    this.activeDownloads--;
    this.processQueue();
  }

  /**
   * 下载YouTube视频
   */
  private async downloadYouTube(task: DownloadTask): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const videoStream = ytdl(task.url, { 
          quality: task.quality || 'highest',
          filter: task.format === 'audio' ? 'audioonly' : 'videoandaudio'
        });
        
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
            
            // 更新总体进度
            if (this.batchSize > 0) {
              const taskWeight = 1 / this.batchSize;
              this.totalProgress = this.getAllTasks()
                .map(t => (t.progress || 0) * taskWeight)
                .reduce((a, b) => a + b, 0);
              this.logger.info(`总体下载进度: ${Math.floor(this.totalProgress)}%`);
            }
          }
        });

        // 确定输出文件名
        const filename = `${task.title || task.id}.mp4`;
        const sanitizedFilename = filename.replace(/[/\\?%*:|"<>]/g, '-');
        const outputPath = path.join(this.config.download.outputDirectory, sanitizedFilename);
        const tempPath = `${outputPath}.temp`;
        
        // 检查是否存在临时文件
        if (fs.existsSync(tempPath)) {
          const stats = fs.statSync(tempPath);
          const rangeStart = stats.size;
          videoStream.destroy();
          
          const newStream = ytdl(task.url, {
            quality: task.quality || 'highest',
            filter: task.format === 'audio' ? 'audioonly' : 'videoandaudio',
            range: { start: rangeStart }
          });
          
          const fileStream = fs.createWriteStream(tempPath, { flags: 'a' });
          newStream.pipe(fileStream);
          
          fileStream.on('finish', () => {
            fs.renameSync(tempPath, outputPath);
            resolve();
          });
          
          return;
        }
        
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
   * 下载抖音视频
   */
  private async downloadDouyin(task: DownloadTask): Promise<void> {
    try {
      const response = await axios.get(task.url, {
        responseType: 'stream',
      });

      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;

      response.data.on('data', (chunk: Buffer) => {
        downloadedBytes += chunk.length;
        const progress = Math.floor((downloadedBytes / totalBytes) * 100);
        this.updateTask(task.id, { progress });
      });

      const filename = `${task.title || task.id}.mp4`;
      const sanitizedFilename = filename.replace(/[/\\?%*:|"<>]/g, '-');
      const outputPath = path.join(this.config.download.outputDirectory, sanitizedFilename);

      this.updateTask(task.id, { outputPath });

      const fileStream = fs.createWriteStream(outputPath);
      response.data.pipe(fileStream);

      fileStream.on('finish', () => {
        this.updateTask(task.id, { status: TaskStatus.COMPLETED, progress: 100 });
        this.logger.info(`下载完成: ${task.id}`);
      });

      fileStream.on('error', (err) => {
        throw err;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.updateTask(task.id, { status: TaskStatus.FAILED, error: errorMessage });
      this.logger.error(`下载失败: ${task.id} - ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 下载B站视频
   */
  private async downloadBilibili(task: DownloadTask): Promise<void> {
    try {
      const { spawn } = require('child_process');
      const filename = `${task.title || task.id}.mp4`;
      const sanitizedFilename = filename.replace(/[/\\?%*:|"<>]/g, '-');
      const outputPath = path.join(this.config.download.outputDirectory, sanitizedFilename);
      
      this.updateTask(task.id, { outputPath });

      // 根据指定的下载器选择不同的下载工具
      const downloader = task.downloader || this.config.download.defaultDownloader || 'yt-dlp';
      
      return new Promise((resolve, reject) => {
        let downloadProcess;
        const options = {
          url: task.url,
          output: outputPath,
          format: task.quality || 'best'
        };

        // 获取 Python Scripts 目录
        const pythonScriptsDir = 'C:\\Users\\60597\\AppData\\Local\\Packages\\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\\LocalCache\\local-packages\\Python313\\Scripts';
        
        switch(downloader) {
          case 'yt-dlp':
            downloadProcess = spawn(path.join(__dirname, '..', 'yt-dlp'), [
              options.url,
              '-o', options.output,
              '--format', options.format
            ]);
            break;
            
          case 'you-get':
            downloadProcess = spawn(path.join(pythonScriptsDir, 'you-get.exe'), [
              options.url,
              '-o', options.output,
              '--format', options.format
            ]);
            break;
            
          case 'annie':
            downloadProcess = spawn('annie', [
              '-o', options.output,
              '-f', options.format,
              options.url
            ]);
            break;
            
          case 'aria2':
            downloadProcess = spawn('aria2c', [
              '-x', '16', // 16线程下载
              '-s', '16', // 16个连接
              '-k', '1M', // 每个分块1M
              '-d', path.dirname(options.output),
              '-o', path.basename(options.output),
              options.url
            ]);
            break;
            
          default:
            throw new Error(`不支持的下载器: ${downloader}`);
        }

        downloadProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          // 解析下载进度
          if (output.includes('%')) {
            const progressMatch = output.match(/(\d+\.?\d*)%/);
            if (progressMatch) {
              const progress = parseFloat(progressMatch[1]);
              this.updateTask(task.id, { progress });
            }
          }
        });

        downloadProcess.on('close', (code: number) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`yt-dlp退出，代码: ${code}`));
          }
        });

        downloadProcess.on('error', (err: Error) => {
          reject(err);
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      throw new Error(`B站视频下载失败: ${errorMessage}`);
    }
  }

  /**
   * 获取抖音播放量较高的视频地址集合
   */
  public async getDouyinPopularVideos(): Promise<string[]> {
    try {
      const response = await axios.get('https://www.douyin.com/aweme/v1/hot/search/', {
        params: {
          count: 10, // 获取前10个热门视频
        },
      });
      const videoUrls = response.data.aweme_list.map((video: any) => video.share_url);
      return videoUrls;
    } catch (error) {
      this.logger.error('获取抖音热门视频失败:', error);
      throw new Error('无法获取抖音热门视频');
    }
  }

  /**
   * 获取B站播放量较高的视频地址集合
   */
  public async getBilibiliPopularVideos(): Promise<string[]> {
    try {
      const response = await axios.get('https://api.bilibili.com/x/web-interface/popular', {
        params: {
          ps: 10, // 获取前10个热门视频
        },
      });
      const videoUrls = response.data.data.list.map((video: any) => `https://www.bilibili.com/video/${video.bvid}`);
      return videoUrls;
    } catch (error) {
      this.logger.error('获取B站热门视频失败:', error);
      throw new Error('无法获取B站热门视频');
    }
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
