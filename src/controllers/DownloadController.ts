import { Request, Response } from 'express';
import { DownloadService } from '../services/DownloadService.js';
import { getLogger } from '../utils/logger.js';

export class DownloadController {
  private downloadService: DownloadService;
  private logger = getLogger();

  constructor(downloadService: DownloadService) {
    this.downloadService = downloadService;
  }

  /**
   * 创建下载任务
   */
  public createTask = async (req: Request, res: Response): Promise<void> => {
    try {
      const { url } = req.body;
      
      if (!url) {
        res.status(400).json({ error: '需要提供URL参数' });
        return;
      }

      const task = await this.downloadService.createTask(url);
      res.status(201).json(task);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.error(`创建任务失败: ${errorMessage}`);
      res.status(500).json({ error: '创建下载任务失败', details: errorMessage });
    }
  };

  /**
   * 获取所有下载任务
   */
  public getAllTasks = (req: Request, res: Response): void => {
    try {
      const tasks = this.downloadService.getAllTasks();
      res.json(tasks);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.error(`获取所有任务失败: ${errorMessage}`);
      res.status(500).json({ error: '获取下载任务列表失败', details: errorMessage });
    }
  };

  /**
   * 获取指定下载任务
   */
  public getTask = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const task = this.downloadService.getTask(id);
      
      if (!task) {
        res.status(404).json({ error: '任务不存在' });
        return;
      }
      
      res.json(task);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.error(`获取任务失败: ${errorMessage}`);
      res.status(500).json({ error: '获取下载任务信息失败', details: errorMessage });
    }
  };

  /**
   * 取消下载任务
   */
  public cancelTask = (req: Request, res: Response): void => {
    try {
      const { id } = req.params;
      const success = this.downloadService.cancelTask(id);
      
      if (!success) {
        res.status(404).json({ error: '任务不存在或无法取消' });
        return;
      }
      
      res.json({ success: true, message: '任务已取消' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      this.logger.error(`取消任务失败: ${errorMessage}`);
      res.status(500).json({ error: '取消下载任务失败', details: errorMessage });
    }
  };
}
