export interface DownloadSettings {
  defaultDir: string;
  createSubDirs: boolean;
  filenameFormat: string;
}

export interface Config {
  downloadSettings: DownloadSettings;
}
