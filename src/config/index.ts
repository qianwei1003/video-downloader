import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { AppConfig } from '../types/config.js';

// 默认配置
const defaultConfig: AppConfig = {
  version: '0.2.0',
  defaultOutputDir: join(homedir(), 'Downloads'),
  logLevel: 'info',
  maxConcurrentDownloads: 2,
  apiPort: 3000,
  apiHost: 'localhost',
};

/**
 * 加载应用配置
 */
export async function loadConfig(): Promise<AppConfig> {
  const configPaths = [
    // 本地项目配置
    join(process.cwd(), 'config.json'),
    // 用户主目录配置
    join(homedir(), '.video-downloader.json'),
  ];
  
  // 合并配置
  let config: AppConfig = { ...defaultConfig };
  
  // 尝试从每个路径读取配置
  for (const path of configPaths) {
    try {
      const fileContent = await fs.readFile(path, 'utf-8');
      const fileConfig = JSON.parse(fileContent);
      config = { ...config, ...fileConfig };
      console.log(`从 ${path} 加载了配置`);
    } catch (err) {
      // 文件不存在或无法解析，使用默认值
    }
  }
  
  // 环境变量覆盖
  if (process.env.OUTPUT_DIR) {
    config.defaultOutputDir = process.env.OUTPUT_DIR;
  }
  
  if (process.env.LOG_LEVEL) {
    config.logLevel = process.env.LOG_LEVEL;
  }
  
  return config;
}

/**
 * 保存配置到默认位置
 */
export async function saveConfig(config: Partial<AppConfig>): Promise<void> {
  const configPath = join(homedir(), '.video-downloader.json');
  
  // 读取现有配置
  let existingConfig: AppConfig;
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    existingConfig = JSON.parse(content);
  } catch (err) {
    existingConfig = { ...defaultConfig };
  }
  
  // 合并配置
  const newConfig = { ...existingConfig, ...config };
  
  // 保存
  await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
}

/**
 * 将 AppConfig 转换为服务需要的 Config 格式
 */
export function convertConfig(appConfig: AppConfig) {
  return {
    server: {
      port: appConfig.apiPort || 3000,
      host: appConfig.apiHost || 'localhost'
    },
    download: {
      outputDirectory: appConfig.defaultOutputDir,
      concurrentDownloads: appConfig.maxConcurrentDownloads,
      retryAttempts: 3,
      timeout: 60000
    },
    log: {
      level: appConfig.logLevel as any,
      filePath: join(appConfig.defaultOutputDir, 'logs')
    }
  };
}
