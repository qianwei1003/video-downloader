import { readFileSync } from 'fs';
import { join } from 'path';

export interface Config {
  downloadPath: string;
  autoStartServer: boolean;
  defaultQuality: string;
  language: string;
}

class ConfigLoader {
  private config: Config;
  private configPath: string;

  constructor() {
    this.configPath = join(process.cwd(), 'config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    try {
      const configFile = readFileSync(this.configPath, 'utf-8');
      return JSON.parse(configFile);
    } catch (error) {
      // 返回默认配置
      return {
        downloadPath: 'downloads',
        autoStartServer: true,
        defaultQuality: 'highest',
        language: 'zh-CN'
      };
    }
  }

  public getConfig(): Config {
    return this.config;
  }

  public getValue<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }
}

export const configLoader = new ConfigLoader();
