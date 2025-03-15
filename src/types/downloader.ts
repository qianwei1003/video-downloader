export interface DownloadOptions {
  url: string;
  format?: string;
  outputDir?: string;
  noPlaylist?: boolean;
  videoId?: string;
  audioOnly?: boolean;
  subtitles?: boolean;
  speedLimit?: string;
}

export interface DownloadProgress {
  percent: number;
  speed: string;
  eta: string;
  size: string;
}
