import { YouTubePlatform } from '../../adapters/youtube/YouTubePlatform';
import { join } from 'path';

describe('YouTube Download Tests', () => {
  const platform = new YouTubePlatform();
  const url = 'https://www.youtube.com/watch?v=pYCf_LTBuXQ';
  const outputPath = join(__dirname, '../../../downloads');

  it('should download video with specific start time', async () => {
    const options = {
      outputPath,
      filename: 'test-video.mp4',
      begin: '95s', // 从95秒开始
      onProgress: (progress: number) => {
        console.log(`下载进度: ${progress}%`);
      }
    };

    const result = await platform.downloadVideo(url, options);
    console.log('视频已下载到:', result);
    expect(result).toBeTruthy();
  }, 300000); // 5分钟超时

  it('should get video info', async () => {
    const info = await platform.getVideoInfo(url);
    console.log('视频信息:', JSON.stringify(info, null, 2));
    expect(info.id).toBeTruthy();
    expect(info.formats.length).toBeGreaterThan(0);
  });
});
