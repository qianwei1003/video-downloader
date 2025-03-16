import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { AppConfig } from '../types/config.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import puppeteer from 'puppeteer';
import { BatchDownloadOptions, BatchDownloadResult, DownloadTask, TaskProgress, DownloadStatus } from '../types/downloader.js';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export class DownloaderService {
  private config: AppConfig;
  private browser: any;
  private tasks: Map<string, DownloadTask>;

  constructor(config: AppConfig) {
    this.config = config;
    this.tasks = new Map();
    // 确保默认下载目录存在
    if (!fs.existsSync(config.defaultOutputDir)) {
      fs.mkdirSync(config.defaultOutputDir, { recursive: true });
    }
  }

  public getTaskStatus(id: string): TaskProgress | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    return {
      id: task.id,
      status: task.status,
      progress: task.progress,
      title: task.title,
      error: task.error
    };
  }

  private updateTaskStatus(id: string, updates: Partial<DownloadTask>) {
    const task = this.tasks.get(id);
    if (!task) return;

    Object.assign(task, {
      ...updates,
      updatedAt: new Date()
    });
    this.tasks.set(id, task);
  }

  private async runYtDlp(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = 'yt-dlp';
      logger.debug(`运行命令: ${command} ${args.join(' ')}`);
      const ytProcess = spawn(command, args);
      let stdout = '';
      let stderr = '';
      ytProcess.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        stdout += text;
        logger.debug(`[yt-dlp] ${text.trim()}`);
        
        // 尝试解析下载进度
        const progressMatch = text.match(/(\d+\.?\d*)%/);
        if (progressMatch) {
          const progress = parseFloat(progressMatch[1]);
          if (!isNaN(progress)) {
            args.forEach(arg => {
              if (typeof arg === 'string' && arg.includes('https://')) {
                const taskId = Array.from(this.tasks.entries())
                  .find(([_, task]) => task.url === arg)?.[0];
                if (taskId) {
                  this.updateTaskStatus(taskId, { progress });
                }
              }
            });
          }
        }
      });
      ytProcess.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderr += text;
        logger.warn(`[yt-dlp] ${text.trim()}`);
      });
      ytProcess.on('close', (code: number) => {
        if (code === 0 || stdout.includes('[download]') || stdout.includes('Merging formats into') || stdout.includes('has already been downloaded')) {
          resolve(stdout);
        } else {
          const realErrors = stderr.split('\n').filter(line => line.includes('ERROR:') && !line.includes('WARNING:')).join('\n');
          if (realErrors) {
            reject(new Error(realErrors));
          } else {
            resolve(stdout || stderr);
          }
        }
      });
      ytProcess.on('error', (err: Error) => {
        reject(new Error(`启动 yt-dlp 失败: ${err.message}`));
      });
    });
  }
  private async getVideoFormats(url: string): Promise<{ bestVideo: string; bestAudio: string }> {
    try {
      const listResult = await this.runYtDlp(['--list-formats', url]);
      const lines = listResult.split('\n');
      
      let bestVideo = '';
      let bestAudio = '';
      let maxVideoQuality = 0;
      let maxAudioQuality = 0;

      for (const line of lines) {
        if (line.includes('mp4') || line.includes('m4a')) {
          const match = line.match(/^(\d+)\s+(\w+)\s+(\d+x\d+|\w+\s+only)\s+/);
          if (match) {
            const [, id, ext, quality] = match;
            
            if (quality.includes('x')) {
              // 视频流
              const resolution = parseInt(quality.split('x')[1]);
              if (resolution > maxVideoQuality) {
                maxVideoQuality = resolution;
                bestVideo = id;
              }
            } else if (quality.includes('audio only')) {
              // 音频流
              const bitrateMatch = line.match(/(\d+)k/);
              if (bitrateMatch) {
                const bitrate = parseInt(bitrateMatch[1]);
                if (bitrate > maxAudioQuality) {
                  maxAudioQuality = bitrate;
                  bestAudio = id;
                }
              }
            }
          }
        }
      }

      return { bestVideo, bestAudio };
    } catch (error) {
      logger.error('获取视频格式失败:', error);
      throw error;
    }
  }
  private isBilibiliUrl(url: string): boolean {
    return url.includes('bilibili.com');
  }

  /**
   * 处理视频下载请求
   */
  async handleDownload(args: any): Promise<{ content: { type: string; text: string; }[] }> {
    const { 
      url, 
      format,
      outputDir,
      noPlaylist = true, 
      videoId,
      audioOnly = false,
      subtitles = false,
      speedLimit
    } = args;

    if (!url) {
      throw new Error('未提供URL');
    }
    const downloadDir = outputDir || this.config.defaultOutputDir;
    const downloadId = uuidv4();
    
    // 创建新的下载任务
    const task: DownloadTask = {
      id: downloadId,
      url,
      status: DownloadStatus.PENDING,
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.tasks.set(downloadId, task);
    
    logger.info(`开始下载 [${downloadId}]: ${url}`);
    this.updateTaskStatus(downloadId, { status: DownloadStatus.DOWNLOADING });
    
    try {
      const options = [
        '--no-format-sort',
        '--no-check-formats',
        '--format-sort-force',
        url,
        '-o', path.join(downloadDir, '%(title)s.%(ext)s'),
        '--ignore-config',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36'
      ];

      if (this.isBilibiliUrl(url)) {
        options.push(
          '--referer', 'https://www.bilibili.com'
        );
      }
      
      if (noPlaylist) {
        options.push('--no-playlist');
      }
      
      if (videoId) {
        options.push('--match-filter', `id=${videoId}`);
      }
      
      if (subtitles) {
        options.push('--write-auto-sub', '--sub-lang', 'zh-Hans,en');
      }
      
      if (speedLimit) {
        options.push('--limit-rate', speedLimit);
      }
      
      const downloadProcess = this.runYtDlp(options);
      const result = await downloadProcess;
      
      // 更新任务状态为已完成
      this.updateTaskStatus(downloadId, {
        status: DownloadStatus.COMPLETED,
        progress: 100
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: downloadId,
            status: DownloadStatus.COMPLETED,
            outputDir: downloadDir,
            message: '下载完成',
            details: result
          })
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`下载失败 [${downloadId}]: ${errorMessage}`);
      
      // 更新任务状态为失败
      this.updateTaskStatus(downloadId, {
        status: DownloadStatus.FAILED,
        error: errorMessage
      });
      
      throw new Error(`视频下载失败: ${errorMessage}`);
    }
  }

  /**
   * 批量下载视频
   */
  async handleBatchDownload(args: BatchDownloadOptions): Promise<{ content: { type: string; text: string; }[] }> {
    const {
      urls,
      format,
      outputDir,
      noPlaylist = true,
      audioOnly = false,
      subtitles = false,
      speedLimit
    } = args;

    if (!urls || urls.length === 0) {
      throw new Error('未提供下载URL列表');
    }

    const result: BatchDownloadResult = {
      totalCount: urls.length,
      successCount: 0,
      failedCount: 0,
      results: []
    };

    // 创建下载任务数组
    const downloadTasks = urls.map(url => 
      this.handleDownload({
        url,
        format,
        outputDir,
        noPlaylist,
        audioOnly,
        subtitles,
        speedLimit
      })
    );

    logger.info(`批量下载任务已启动: ${urls.length} 个任务`);

    // 使用 Promise.allSettled 等待所有任务完成
    const outcomes = await Promise.allSettled(downloadTasks);
    
    // 处理每个任务的结果
    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') {
        result.successCount++;
        result.results.push({
          url: urls[index],
          status: 'completed'
        });
      } else {
        result.failedCount++;
        result.results.push({
          url: urls[index],
          status: 'failed',
          message: outcome.reason?.message || '未知错误'
        });
      }
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ...result,
          message: `成功: ${result.successCount}, 失败: ${result.failedCount}`
        })
      }]
    };
  }

  /**
   * 列出已下载的视频
   */
  async listDownloads(dirPath?: string): Promise<{ content: { type: string; text: string; }[] }> {
    const targetDir = dirPath || this.config.defaultOutputDir;
    try {
      if (!fs.existsSync(targetDir)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ files: [] })
          }]
        };
      }
      const files = await readdir(targetDir);
      const mediaFiles: any[] = [];
      for (const file of files) {
        const filePath = path.join(targetDir, file);
        const stats = await stat(filePath);
        if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();
          if (['.mp4', '.webm', '.mkv', '.avi', '.mov', '.mp3', '.m4a', '.flac', '.wav'].includes(ext)) {
            mediaFiles.push({
              name: file,
              path: filePath,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime,
            });
          }
        }
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ files: mediaFiles })
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`列出下载文件失败: ${errorMessage}`);
      throw new Error(`无法获取下载列表: ${errorMessage}`);
    }
  }

  public async getDouyinPopularVideos() {
    interface DouyinVideo {
      title: string;
      author: string;
      playCount: string;
      likes: string;
      url: string;
    }

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await this.browser.newPage();
      await page.evaluateOnNewDocument(() => { (window as any).require = function() {}; });
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      await page.goto('https://www.douyin.com/hot', {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await page.waitForSelector('.EHRpL4gB', { timeout: 60000 });

      const videos: DouyinVideo[] = await page.evaluate(() => {
        const items = document.querySelectorAll('.EHRpL4gB');
        return Array.from(items).slice(0, 10).map((item: any) => ({
          title: item.querySelector('.title')?.textContent || '未知标题',
          author: item.querySelector('.author')?.textContent || '未知作者',
          playCount: item.querySelector('.play-count')?.textContent || '0',
          likes: item.querySelector('.like-count')?.textContent || '0',
          url: item.querySelector('a')?.href || ''
        }));
      });

      logger.debug('抖音热门视频数据：', videos);

      await this.browser.close();
      
      const formattedVideos = videos.map(video => 
        `标题: ${video.title}\n作者: ${video.author}\n播放量: ${video.playCount}\n点赞数: ${video.likes}\n视频链接: ${video.url}\n==================`
      ).join('\n');
      
      return {
        content: [{
          type: 'text',
          text: formattedVideos
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error('获取抖音热门视频失败:', error);
      return {
        content: [{
          type: 'text',
          text: '获取抖音热门视频失败: ' + errorMessage
        }]
      };
    }
  }

  public async getBilibiliPopularVideos() {
    try {
      const response = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=20&pn=1');
      const data = await response.json();
      
      if (data.code === 0 && data.data && Array.isArray(data.data.list)) {
        interface BilibiliVideo {
          title: string;
          url: string;
          play: number;
          author: string;
          duration: number;
        }

        const videos = data.data.list.map((video: any) => ({
          title: video.title,
          url: `https://www.bilibili.com/video/${video.bvid}`,
          play: video.stat.view,
          author: video.owner.name,
          duration: video.duration
        }));
        
        const formattedVideos = videos.map((video: BilibiliVideo) => 
          `标题: ${video.title}\n播放量: ${video.play}\n作者: ${video.author}\n地址: ${video.url}\n时长: ${video.duration}秒\n==================`
        ).join('\n');
        
        return {
          content: [{
            type: 'text',
            text: formattedVideos
          }]
        };
      } else {
        throw new Error('获取B站热门视频失败');
      }
    } catch (error) {
      logger.error('获取B站热门视频失败:', error);
      return {
        content: [{
          type: 'text',
          text: '获取B站热门视频失败: ' + (error instanceof Error ? error.message : '未知错误')
        }]
      };
    }
  }
}
