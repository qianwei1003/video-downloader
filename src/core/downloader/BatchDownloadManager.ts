import { DownloadManager } from './DownloadManager';
import { URLValidator } from '../../utils/validator';
import { Logger } from '../../lib/logger';

const logger = new Logger();

interface TaskStatus {
  id: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  url: string;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

interface DownloadResult {
  url: string;
  success: boolean;
  message: string;
  info?: {
    title: string;
    duration: number;
  };
}

interface BatchDownloadOptions {
  outputPath: string;
  onProgress?: (url: string, progress: number) => void;
}

export class BatchDownloadManager {
  private downloadManager: DownloadManager;
  private tasks: Map<string, TaskStatus>;

  constructor() {
    this.downloadManager = new DownloadManager();
    this.tasks = new Map();
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async download(urls: string[], options: BatchDownloadOptions): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];

    for (const url of urls) {
      const taskId = this.generateTaskId();
      const task: TaskStatus = {
        id: taskId,
        progress: 0,
        status: 'pending',
        url: url,
        startTime: new Date(),
      };
      this.tasks.set(taskId, task);

      try {
        task.status = 'downloading';
        if (!URLValidator.isValidUrl(url)) {
          results.push({
            url,
            success: false,
            message: '无效的URL'
          });
          continue;
        }

        const platformName = URLValidator.getPlatformName(url);
        if (!platformName) {
          results.push({
            url,
            success: false,
            message: '不支持的平台'
          });
          continue;
        }

        const sanitizedUrl = URLValidator.sanitizeInput(url);
        logger.info(`开始下载: ${url}`);
        
        const info = await this.downloadManager.getVideoInfo(sanitizedUrl);
        await this.downloadManager.startDownload(sanitizedUrl, {
          outputPath: options.outputPath,
          onProgress: (progress) => {
            task.progress = progress;
            options.onProgress?.(url, progress);
          }
        });
        
        task.status = 'completed';
        task.endTime = new Date();

        results.push({
          url,
          success: true,
          message: '下载成功',
          info: {
            title: info.title,
            duration: info.duration
          }
        });
      } catch (error) {
        task.status = 'failed';
        task.error = error instanceof Error ? error.message : String(error);
        task.endTime = new Date();
        results.push({
          url,
          success: false,
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return null;
    }
    return { ...task };
  }

  getAllTasks(): TaskStatus[] {
    return Array.from(this.tasks.values()).map(task => ({ ...task }));
  }
}
