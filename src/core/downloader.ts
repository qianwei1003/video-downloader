/// src/core/downloader.ts

import { DownloadOptions } from "../utils/types";
import { IPlatform } from "../platforms/platform.interface";

/**
 * Downloader
 * 负责从给定的链接下载视频、音频或字幕等
 */
export class Downloader {
  private platforms: Map<string, IPlatform> = new Map();

  /**
   * 注册平台
   * @param domain 平台域名 (例如 "bilibili.com")
   * @param platform 平台实现
   */
  public registerPlatform(domain: string, platform: IPlatform): void {
    this.platforms.set(domain, platform);
  }

  /**
   * 从 URL 中获取域名
   */
  private getDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      // 标准化域名，移除www并处理常见变体
      return domain.replace(/^(www\.)?(m\.)?/, '');
    } catch (e) {
      throw new Error(`无效的URL: ${url}`);
    }
  }

  /**
   * 下载视频
   */
  public async download(url: string, options: DownloadOptions): Promise<void> {
    console.log(`[Downloader] 开始下载: ${url}`);
    console.log("下载选项:", options);
    
    const domain = this.getDomain(url);
    const platform = this.platforms.get(domain);
    
    if (!platform) {
      throw new Error(`不支持的平台: ${domain}`);
    }

    try {
      await platform.downloadVideo(url, options);
      console.log(`[Downloader] 下载完成: ${url}`);
    } catch (error) {
      console.error(`[Downloader] 下载失败:`, error);
      throw error;
    }
  }
}
