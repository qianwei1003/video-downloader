import { BilibiliPlatform } from '../../adapters/bilibili/BilibiliPlatform';
import { BatchDownloadManager } from '../../core/downloader/BatchDownloadManager';
import { join } from 'path';

describe('Bilibili Batch Download Tests', () => {
  const platform = new BilibiliPlatform();
  const outputPath = join(__dirname, '../../../downloads');
  
  // 测试视频列表 - 使用较短的视频进行测试
  const videoUrls = [
    'https://www.bilibili.com/video/BV1GJ411x7h7',  // 示例视频1
    'https://www.bilibili.com/video/BV1xx411c7mD',  // 示例视频2
  ];

  it('should initialize batch download manager', () => {
    const manager = new BatchDownloadManager();
    expect(manager).toBeTruthy();
  });

  it('should download multiple videos', async () => {
    const manager = new BatchDownloadManager();
    const results = await manager.download(videoUrls, {
      outputPath,
      onProgress: (url: string, progress: number) => {
        console.log(`下载进度 ${url}: ${progress}%`);
      }
    });

    const tasks = manager.getAllTasks();
    expect(tasks.length).toBe(videoUrls.length);
    expect(results.length).toBe(videoUrls.length);
  });

  it('should handle download failures', async () => {
    const manager = new BatchDownloadManager();
    
    // 包含一个无效URL来测试错误处理
    const urlsWithInvalid = [
      ...videoUrls,
      'https://www.bilibili.com/video/invalid-video-id'
    ];

    const results = await manager.download(urlsWithInvalid, {
      outputPath,
      onProgress: (url: string, progress: number) => {
        console.log(`下载进度 ${url}: ${progress}%`);
      }
    });

    const tasks = manager.getAllTasks();
    const failedTasks = tasks.filter(task => task.status === 'failed');
    
    expect(failedTasks.length).toBe(1);
    expect(failedTasks[0].url).toContain('invalid-video-id');
    
    // 检查结果
    const failedResults = results.filter(result => !result.success);
    expect(failedResults.length).toBe(1);
    expect(failedResults[0].url).toContain('invalid-video-id');
  }, 600000); // 10分钟超时
});
