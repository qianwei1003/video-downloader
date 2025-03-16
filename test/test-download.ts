import { DownloaderService } from '../src/services/DownloaderService.js';
import path from 'path';
import { fileURLToPath } from 'url';

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
    // B站视频测试链接
    const url = 'https://www.bilibili.com/video/BV1GJ411x7h7';
    console.log('开始下载测试...');
    
    const result = await downloader.handleDownload({
      url,
      noPlaylist: true,
      subtitles: true
    });
    
    console.log('下载结果:', result.content[0].text);
  } catch (err) {
    console.error('下载测试失败:', err);
  }
}

runTest();
