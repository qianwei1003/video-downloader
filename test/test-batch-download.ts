import { DownloaderService } from '../src/services/DownloaderService.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { BatchDownloadOptions } from '../src/types/downloader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
  // 创建测试配置
  const config = {
    version: '1.0.0',
    defaultOutputDir: path.join(__dirname, '../../downloads'),
    logLevel: 'debug',
    maxConcurrentDownloads: 3
  };

  const downloader = new DownloaderService(config);
  try {
    // 测试视频链接列表
    const urls = [
      'https://www.bilibili.com/video/BV1GJ411x7h7',  // Rick Astley
      'https://www.bilibili.com/video/BV1xx411c7mD'   // 另一个测试视频
    ];

    console.log('开始批量下载测试...');
    
    const options: BatchDownloadOptions = {
      urls,
      noPlaylist: true,
      subtitles: true,
      outputDir: config.defaultOutputDir
    };

    const result = await downloader.handleBatchDownload(options);
    
    console.log('批量下载结果:', result.content[0].text);

    // 等待一段时间确保下载开始
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 列出已下载的文件
    const downloadedFiles = await downloader.listDownloads();
    console.log('已下载的文件:', downloadedFiles.content[0].text);

  } catch (err) {
    console.error('批量下载测试失败:', err);
  }
}

runTest();
