import ytdl from 'ytdl-core';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { IPlatform, VideoInfo, VideoFormat, DownloadOptions, AdvancedDownloadOptions } from '@core/platform/IPlatform';
import { Logger } from '@lib/logger';
import { withRetry } from '@utils/retry';
import { YouTubeAuthProvider } from './YouTubeAuthProvider';
import { AuthManager } from '@core/auth/AuthManager';

export class YouTubePlatform implements IPlatform {
  private logger: Logger;
  private authProvider: YouTubeAuthProvider;
  private authManager: AuthManager;

  constructor() {
    this.logger = new Logger();
    this.authProvider = new YouTubeAuthProvider();
    this.authManager = AuthManager.getInstance();
    if (!this.authManager.hasAuthProvider('youtube')) {
      this.authManager.registerAuthProvider('youtube', this.authProvider);
    }
  }

  getName(): string {
    return 'YouTube';
  }

  isSupported(url: string): boolean {
    return ytdl.validateURL(url);
  }

  async getVideoInfo(url: string): Promise<VideoInfo> {
    try {
      // 检查是否需要认证
      const needAuth = await this.authProvider.isAuthRequired(url);
      if (needAuth) {
        const credentials = this.authProvider.getCredentials();
        if (!credentials) {
          throw new Error('需要认证才能访问此视频');
        }
      }

      this.logger.info('正在获取视频信息（可能需要一些时间）...');
      const info = await withRetry(
        async () => {
          // 使用认证信息获取视频详情
          const credentials = this.authProvider.getCredentials();
          const options: ytdl.getInfoOptions = {
            requestOptions: {
              headers: credentials ? {
                ...(credentials.cookies ? { cookie: credentials.cookies } : {}),
                ...(credentials.token ? { Authorization: `Bearer ${credentials.token}` } : {})
              } : {}
            }
          };

          const result = await ytdl.getInfo(url, options);
          this.logger.info('成功获取视频信息');
          return result;
        },
        3,
        2000
      );
      
      const formats = info.formats.map((format: ytdl.videoFormat) => ({
        formatId: format.itag.toString(),
        quality: format.qualityLabel || 'audio only',
        container: format.container,
        hasAudio: format.hasAudio || false,
        hasVideo: format.hasVideo || false,
        filesize: format.contentLength ? parseInt(format.contentLength) : undefined
      }));

      return {
        id: info.videoDetails.videoId,
        title: info.videoDetails.title,
        description: info.videoDetails.description || undefined,
        duration: parseInt(info.videoDetails.lengthSeconds),
        thumbnailUrl: info.videoDetails.thumbnails[0]?.url,
        formats
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Video unavailable')) {
          this.logger.error('视频不可用或已被删除');
        } else if (error.message.includes('Status code: 429')) {
          this.logger.error('请求过于频繁，请稍后再试');
        } else {
          this.logger.error('获取视频信息失败:', error.message);
        }
      } else {
        this.logger.error('获取视频信息失败:', error);
      }
      throw error;
    }
  }

  async downloadVideo(url: string, options: DownloadOptions & AdvancedDownloadOptions): Promise<string> {
    try {
      // 检查是否需要认证
      const needAuth = await this.authProvider.isAuthRequired(url);
      if (needAuth) {
        const credentials = this.authProvider.getCredentials();
        if (!credentials) {
          throw new Error('需要认证才能下载此视频');
        }
      }

      // 获取视频信息时包含认证信息
      const credentials = this.authProvider.getCredentials();
      const ytdlOptions: ytdl.getInfoOptions = {
        requestOptions: {
          headers: credentials ? {
            ...(credentials.cookies ? { cookie: credentials.cookies } : {}),
            ...(credentials.token ? { Authorization: `Bearer ${credentials.token}` } : {})
          } : {}
        }
      };

      const info = await ytdl.getInfo(url, ytdlOptions);
      const format = options.format ? 
        info.formats.find(f => f.itag.toString() === options.format) :
        ytdl.chooseFormat(info.formats, { quality: 'highest' });

      if (!format) {
        throw new Error('找不到指定的格式');
      }

      const filename = options.filename || `${info.videoDetails.title}.${format.container}`;
      const outputPath = join(options.outputPath, filename);

      // 构建下载选项
      const downloadOptions: ytdl.downloadOptions = {
        format,
        // 高级下载选项
        ...(options.range && { range: options.range }), // 字节范围下载
        ...(options.begin && { begin: options.begin }), // 开始时间
        ...(options.liveBuffer && { liveBuffer: options.liveBuffer }), // 直播缓冲大小
        ...(options.dlChunkSize !== undefined && { dlChunkSize: options.dlChunkSize }), // 分块大小
        ...(options.IPv6Block && { IPv6Block: options.IPv6Block }) // IPv6地址块
      };

      return new Promise((resolve, reject) => {
        const stream = ytdl(url, downloadOptions);
        let lastProgress = 0;

        stream.on('progress', (_, downloaded, total) => {
          if (options.onProgress && total) {
            const progress = Math.floor((downloaded / total) * 100);
            if (progress > lastProgress) {
              options.onProgress(progress);
              lastProgress = progress;
            }
          }
        });

        stream.pipe(createWriteStream(outputPath))
          .on('finish', () => resolve(outputPath))
          .on('error', reject);
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('This video is unavailable')) {
          this.logger.error('视频不可用，可能是地区限制或已被删除');
        } else if (error.message.includes('No such format found')) {
          this.logger.error('找不到指定的视频格式，请尝试其他格式');
        } else {
          this.logger.error('下载视频失败:', error.message);
        }
      } else {
        this.logger.error('下载视频失败:', error);
      }
      throw error;
    }
  }
}
