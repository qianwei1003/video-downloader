export interface BatchDownloadOptions {
  urls: string[];
  format?: string;
  outputDir?: string;
  noPlaylist?: boolean;
  audioOnly?: boolean;
  subtitles?: boolean;
  speedLimit?: string;
}

export interface BatchDownloadResult {
  totalCount: number;
  successCount: number;
  failedCount: number;
  results: Array<{
    url: string;
    status: 'completed' | 'failed';
    message?: string;
  }>;
}

export interface DownloadTask {
  id: string;
  url: string;
  status: DownloadStatus;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  outputPath?: string;
  title?: string;
  error?: string;
  retryCount?: number;
  quality?: string;
  format?: 'video' | 'audio';
}

export enum DownloadStatus {
  PENDING = 'pending',
  DOWNLOADING = 'downloading',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled'
}

export interface TaskProgress {
  id: string;
  status: DownloadStatus;
  progress: number;
  title?: string;
  error?: string;
}
