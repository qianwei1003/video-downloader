import { BilibiliPlatform } from '../../adapters/bilibili/BilibiliPlatform';
import { join } from 'path';

describe('Bilibili Download Tests', () => {
  const platform = new BilibiliPlatform();
  // BV1GJ411x7h7 是一个示例视频
  const url = 'https://www.bilibili.com/video/BV1GJ411x7h7';
  const outputPath = join(__dirname, '../../../downloads');

  it('should get video info', async () => {
    const info = await platform.getVideoInfo(url);
    console.log('视频信息:', JSON.stringify(info, null, 2));
    expect(info.id).toBeTruthy();
    expect(info.formats.length).toBeGreaterThan(0);
  }, 10000); // 10秒超时

  it('should download video', async () => {
    const options = {
      outputPath,
      filename: 'bilibili-test-video.mp4',
      onProgress: (progress: number) => {
        console.log(`下载进度: ${progress}%`);
      }
    };

    const result = await platform.downloadVideo(url, options);
    console.log('视频已下载到:', result);
    expect(result).toBeTruthy();
  }, 300000); // 5分钟超时
});
