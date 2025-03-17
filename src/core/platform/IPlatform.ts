export interface VideoInfo {
  id: string;
  title: string;
  description?: string;
  duration: number;
  thumbnailUrl?: string;
  formats: VideoFormat[];
}

export interface VideoFormat {
  formatId: string;
  quality: string;
  container: string;
  hasAudio: boolean;
  hasVideo: boolean;
  filesize?: number;
}

export interface DownloadOptions {
  format?: string;
  quality?: string;
  outputPath: string;
  filename?: string;
  onProgress?: (progress: number) => void;
}

export interface AdvancedDownloadOptions {
  /**
   * 字节范围下载，格式: {start: number, end: number}
   * 例如: {start: 10355705, end: 12452856}
   */
  range?: { start: number; end: number };

  /**
   * 视频开始时间，支持格式:
   * - "00:00:00.000"
   * - "0ms, 0s, 0m, 0h"
   * - 毫秒数
   * - 对于直播视频，也支持 unix 时间戳或 Date 对象
   */
  begin?: string | number | Date;

  /**
   * 直播视频的缓冲时间(毫秒)
   * 默认: 20000
   */
  liveBuffer?: number;

  /**
   * 分块下载大小(字节)
   * 默认: 10MB
   * 设置为 0 禁用分块下载
   */
  dlChunkSize?: number;

  /**
   * IPv6 地址块，用于轮换 IP 地址
   * 作为代理的替代方案
   */
  IPv6Block?: string;
}

export interface PopularVideo {
  id: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  url: string;
  viewCount?: number;
  uploadDate?: string;
}

export interface IPlatform {
  getName(): string;
  isSupported(url: string): boolean;
  getVideoInfo(url: string): Promise<VideoInfo>;
  downloadVideo(url: string, options: DownloadOptions & AdvancedDownloadOptions): Promise<string>;
  getPopularVideos(count?: number): Promise<PopularVideo[]>;
}
