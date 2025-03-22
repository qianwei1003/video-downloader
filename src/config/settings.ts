import fs from "fs";
import path from "path";
import { Config, DownloadSettings } from "../types/config.js";

const CONFIG_FILE = path.join(process.cwd(), "config", "download-config.json");

const DEFAULT_CONFIG: Config = {
  downloadSettings: {
    defaultDir: path.join(process.cwd(), "downloads"),
    createSubDirs: true,
    filenameFormat: "{title}_{quality}"
  }
};

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public getConfig(): Config {
    return this.config;
  }

  public getDownloadSettings(): DownloadSettings {
    return this.config.downloadSettings;
  }

  public updateConfig(newConfig: Partial<Config>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
    this.saveConfig();
  }

  public updateDownloadSettings(settings: Partial<DownloadSettings>): void {
    this.config.downloadSettings = {
      ...this.config.downloadSettings,
      ...settings
    };
    this.saveConfig();
  }

  private loadConfig(): Config {
    try {
      if (!fs.existsSync(CONFIG_FILE)) {
        const dirPath = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
        return DEFAULT_CONFIG;
      }

      const configContent = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(configContent);
    } catch (error) {
      console.error("Error loading config:", error);
      return DEFAULT_CONFIG;
    }
  }

  private saveConfig(): void {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error("Error saving config:", error);
    }
  }
}

export const configManager = ConfigManager.getInstance();
