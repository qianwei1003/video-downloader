import { PlatformFactory } from '@core/platform/PlatformFactory';
import { BilibiliPlatform } from './BilibiliPlatform';
import { IPlatform } from '@core/platform/IPlatform';

export class BilibiliPlatformFactory extends PlatformFactory {
  createPlatform(): IPlatform {
    return new BilibiliPlatform();
  }

  getPlatformName(): string {
    return 'bilibili';
  }

  matchUrl(url: string): boolean {
    return /bilibili\.com\/video\/([A-Za-z0-9]+)/.test(url);
  }
}
