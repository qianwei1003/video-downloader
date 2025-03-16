export interface PlatformConfig {
  name: string;
  enabled: boolean;
  options?: Record<string, any>;
}

export interface PlatformsConfig {
  platforms: Record<string, PlatformConfig>;
}

const defaultConfig: PlatformsConfig = {
  platforms: {
    youtube: {
      name: 'YouTube',
      enabled: true,
      options: {
        maxRetries: 3,
        retryDelay: 2000
      }
    },
    bilibili: {
      name: 'Bilibili',
      enabled: true,
      options: {
        maxRetries: 3,
        retryDelay: 2000,
        cookies: '', // B站的cookie，可选
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }
  }
};

export function loadPlatformsConfig(): PlatformsConfig {
  try {
    // 在这里可以添加从文件或环境变量加载配置的逻辑
    return defaultConfig;
  } catch (error) {
    console.warn('加载平台配置失败，使用默认配置:', error);
    return defaultConfig;
  }
}

export function isPlatformEnabled(platformName: string): boolean {
  const config = loadPlatformsConfig();
  return config.platforms[platformName]?.enabled ?? false;
}

export function getPlatformConfig<T extends PlatformConfig>(platformName: string): T | null {
  const config = loadPlatformsConfig();
  return (config.platforms[platformName] as T) || null;
}
