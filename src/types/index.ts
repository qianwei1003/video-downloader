/**
 * 服务器配置
 */
export interface ServerConfig {
  port: number;
  host: string;
}

/**
 * 下载配置
 */
export interface DownloadConfig {
  outputDirectory: string;
  concurrentDownloads: number;
  retryAttempts: number;
  timeout: number;
  defaultDownloader?: 'yt-dlp' | 'you-get' | 'annie' | 'aria2';
}

/**
 * 日志配置
 */
export interface LogConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  filePath: string;
}

/**
 * 应用程序配置
 */
export interface Config {
  server: ServerConfig;
  download: DownloadConfig;
  log: LogConfig;
}

/**
 * 下载任务状态
 */
export enum TaskStatus {
  PENDING = 'pending',
  DOWNLOADING = 'downloading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled'
}

/**
 * 下载任务信息
 */
export interface DownloadTask {
  id: string;
  url: string;
  title?: string;
  status: TaskStatus;
  progress: number;
  outputPath?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  retryCount?: number;
  quality?: string;
  format?: 'video' | 'audio';
  downloader?: 'yt-dlp' | 'you-get' | 'annie' | 'aria2';
}

// 从 downloader.ts 导出其他类型
export * from './downloader.js';
