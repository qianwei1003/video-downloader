import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';
import { AppConfig } from '../types/config.js';

export class MediaInfoService {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * 获取媒体信息
   */
  async getMediaInfo(url: string): Promise<any> {
    if (!url) {
      throw new Error('未提供URL');
    }
    
    logger.info(`获取媒体信息: ${url}`);
    
    try {
      const options = [
        url,
        '--dump-json',
        '--no-playlist',
        '--skip-download',
      ];
      
      const jsonOutput = await this.runYtDlp(options);
      const mediaInfo = JSON.parse(jsonOutput);
      
      return {
        title: mediaInfo.title,
        description: mediaInfo.description,
        uploader: mediaInfo.uploader,
        upload_date: mediaInfo.upload_date,
        duration: mediaInfo.duration,
        view_count: mediaInfo.view_count,
        like_count: mediaInfo.like_count,
        formats: mediaInfo.formats?.map((f: any) => ({
          format_id: f.format_id,
          ext: f.ext,
          resolution: f.resolution,
          fps: f.fps,
          vcodec: f.vcodec,
          acodec: f.acodec,
          filesize: f.filesize,
        })) || [],
        thumbnails: mediaInfo.thumbnails?.map((t: any) => ({
          url: t.url,
          height: t.height,
          width: t.width,
        })) || [],
        subtitles: mediaInfo.subtitles || {},
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`获取媒体信息失败: ${errorMessage}`);
      throw new Error(`无法获取媒体信息: ${errorMessage}`);
    }
  }

  /**
   * 运行yt-dlp命令
   */
  private async runYtDlp(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const command = 'yt-dlp';
      logger.debug(`运行命令: ${command} ${args.join(' ')}`);
      
      const process = spawn(command, args);
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
        logger.warn(`[yt-dlp] ${data.toString().trim()}`);
      });
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`yt-dlp 退出代码 ${code}: ${stderr}`));
        }
      });
      
      process.on('error', (err) => {
        reject(new Error(`启动 yt-dlp 失败: ${err.message}`));
      });
    });
  }
}
