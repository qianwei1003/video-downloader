/**
 * 应用配置接口定义
 */
export interface AppConfig {
  version: string;
  defaultOutputDir: string;
  logLevel: string;
  maxConcurrentDownloads: number;
  
  // 可选的额外配置
  apiPort?: number;
  apiHost?: string;
}
