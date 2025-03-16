import { PlatformFactory } from '@core/platform/PlatformFactory';
import { IPlatform } from '@core/platform/IPlatform';
import { YouTubePlatform } from './YouTubePlatform';
import ytdl from 'ytdl-core';

export class YouTubePlatformFactory extends PlatformFactory {
  createPlatform(): IPlatform {
    return new YouTubePlatform();
  }

  getPlatformName(): string {
    return 'YouTube';
  }

  matchUrl(url: string): boolean {
    return ytdl.validateURL(url);
  }
}
