import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { AppConfig } from '../types/config.js';
import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

export class DownloaderService {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
    
    // 确保默认下载目录存在
    if (!fs.existsSync(config.defaultOutputDir)) {
      fs.mkdirSync(config.defaultOutputDir, { recursive: true });
    }
  }

  private isBilibiliUrl(url: string): boolean {
    return url.includes('bilibili.com');
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

  /**
   * 处理视频下载请求
   */
  async handleDownload(args: any) {
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
    
    logger.info(`开始下载 [${downloadId}]: ${url}`);
    
    try {
      // 最简单的参数组合，完全依赖yt-dlp自动选择格式
      const options = [
        '--no-format-sort',
        '--no-check-formats',
        '--format-sort-force',
        url,
        '-o', path.join(downloadDir, '%(title)s.%(ext)s'),
        '--ignore-config'  // 忽略任何配置文件
      ];

      // B站特定选项
      if (this.isBilibiliUrl(url)) {
        options.push(
          '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
          '--referer', 'https://www.bilibili.com'
        );
      }
      
      // 通用选项
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
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id: downloadId,
            status: 'completed',
            outputDir: downloadDir,
            message: '下载完成',
            details: result
          })
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`下载失败 [${downloadId}]: ${errorMessage}`);
      throw new Error(`视频下载失败: ${errorMessage}`);
    }
  }

  /**
   * 列出已下载的视频
   */
  async listDownloads(dirPath?: string) {
    const targetDir = dirPath || this.config.defaultOutputDir;
    
    try {
      if (!fs.existsSync(targetDir)) {
        return { files: [] };
      }
      
      const files = await readdir(targetDir);
      const mediaFiles = [];
      
      for (const file of files) {
        const filePath = path.join(targetDir, file);
        const stats = await stat(filePath);
        
        if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();
          
          // 过滤视频和音频文件
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
        const text = data.toString();
        stdout += text;
        logger.debug(`[yt-dlp] ${text.trim()}`);
      });
      
      process.stderr.on('data', (data) => {
        const text = data.toString();
        stderr += text;
        logger.warn(`[yt-dlp] ${text.trim()}`);
      });
      
      process.on('close', (code) => {
        // 这些情况都认为是成功的
        if (code === 0 || 
            stdout.includes('[download]') || 
            stdout.includes('Merging formats into') ||
            stdout.includes('has already been downloaded')) {
          resolve(stdout);
          return;
        }

        // 只有明确的错误才拒绝
        const realErrors = stderr
          .split('\n')
          .filter(line => line.includes('ERROR:') && !line.includes('WARNING:'))
          .join('\n');
          
        if (realErrors) {
          reject(new Error(realErrors));
        } else {
          // 如果没有明确的错误，尝试继续
          resolve(stdout || stderr);
        }
      });
      
      process.on('error', (err) => {
        reject(new Error(`启动 yt-dlp 失败: ${err.message}`));
      });
    });
  }
}
