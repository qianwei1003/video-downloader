import { Logger } from '@lib/logger';
import { DownloadOptions } from '@core/platform/IPlatform';
import { PlatformRegistry } from '@core/platform/PlatformFactory';
import { YouTubePlatformFactory } from '@adapters/youtube/YouTubePlatformFactory';
import { BilibiliPlatformFactory } from '@adapters/bilibili/BilibiliPlatformFactory';
import { isPlatformEnabled, getPlatformConfig } from '@lib/config/platforms';

export class DownloadManager {
  private logger: Logger;
  private registry: PlatformRegistry;

  constructor() {
    this.logger = new Logger();
    this.registry = PlatformRegistry.getInstance();
    
    // 注册支持的平台
    this.registerPlatforms();
  }

  private registerPlatforms(): void {
    const factories = [
      new YouTubePlatformFactory(),
      new BilibiliPlatformFactory()
    ];

    for (const factory of factories) {
      const platformName = factory.getPlatformName().toLowerCase();
      if (isPlatformEnabled(platformName)) {
        try {
          this.registry.registerFactory(factory);
          this.logger.info(`已注册平台: ${platformName}`);
        } catch (error) {
          this.logger.error(`注册平台失败 ${platformName}:`, error);
        }
      } else {
        this.logger.info(`平台未启用: ${platformName}`);
      }
    }
  }

  private getPlatform(url: string) {
    return this.registry.createPlatform(url);
  }

  getSupportedPlatforms(): string[] {
    return this.registry.getAllPlatformNames();
  }

  async getVideoInfo(url: string) {
    const platform = this.getPlatform(url);
    if (!platform) {
      throw new Error(`不支持的视频网站: ${url}`);
    }

    try {
      const info = await platform.getVideoInfo(url);
      return info;
    } catch (error) {
      this.logger.error('获取视频信息失败:', error);
      throw error;
    }
  }

  async startDownload(url: string, options: DownloadOptions) {
    const platform = this.getPlatform(url);
    if (!platform) {
      throw new Error(`不支持的视频网站: ${url}`);
    }

    try {
      const filePath = await platform.downloadVideo(url, options);
      this.logger.info(`视频已保存到: ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error('下载失败:', error);
      throw error;
    }
  }
}
