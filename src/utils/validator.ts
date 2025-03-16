import { PlatformRegistry } from '@core/platform/PlatformFactory';

export class URLValidator {
  private static registry = PlatformRegistry.getInstance();

  static isValidUrl(url: string): boolean {
    return this.registry.getAllPlatformNames().some(name => {
      const factory = this.registry.getPlatformFactory(name);
      return factory?.matchUrl(url) || false;
    });
  }

  static getPlatformName(url: string): string | null {
    for (const name of this.registry.getAllPlatformNames()) {
      const factory = this.registry.getPlatformFactory(name);
      if (factory?.matchUrl(url)) {
        return name;
      }
    }
    return null;
  }

  static sanitizeInput(input: string): string {
    // 移除首尾空格
    input = input.trim();
    
    // 将多个空格替换为单个空格
    input = input.replace(/\s+/g, ' ');
    
    // 确保URL以http(s)开头
    if (!input.startsWith('http')) {
      // 处理常见URL前缀问题
      if (input.startsWith('www.')) {
        input = 'https://' + input;
      } else if (input.startsWith('youtube.com')) {
        input = 'https://www.' + input;
      } else if (input.startsWith('youtu.be')) {
        input = 'https://' + input;
      }
    }
    
    return input;
  }

  static getVideoId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      
      // 处理 youtu.be 格式
      if (urlObj.hostname === 'youtu.be') {
        return urlObj.pathname.slice(1);
      }
      
      // 处理标准 youtube.com 格式
      if (urlObj.hostname.includes('youtube.com')) {
        const videoId = urlObj.searchParams.get('v');
        if (videoId) {
          return videoId;
        }
      }
      
      return null;
    } catch {
      // URL 解析失败
      return null;
    }
  }

  static isPlaylist(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.has('list');
    } catch {
      return false;
    }
  }
}
