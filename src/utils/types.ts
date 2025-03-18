export interface DownloadOptions {
  quality?: 'high' | 'medium' | 'low';
  downloadSubtitle?: boolean;
  downloadAudio?: boolean;
  onlyAudio?: boolean;
  outputPath?: string;
}

export interface FileConfig {
  allowedDirs: string[];
  maxDepth: number;
}

export interface EnvironmentConfig {
  DOWNLOAD_BASE_PATH: string;
  MAX_FILE_SIZE: string;
}
