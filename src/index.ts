import { Logger } from '@lib/logger';
import { DownloadManager } from '@core/downloader/DownloadManager';
import { configLoader } from '@lib/config';
import { showBanner } from '@utils/banner';
import { URLValidator } from '@utils/validator';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import readline from 'readline';

const logger = new Logger();
const downloader = new DownloadManager();
const config = configLoader.getConfig();

async function downloadVideo(url: string) {
  try {
    // 验证URL
    if (!URLValidator.isValidUrl(url)) {
      logger.error('无效的URL');
      return;
    }

    const platformName = URLValidator.getPlatformName(url);
    if (!platformName) {
      logger.error('不支持的平台');
      return;
    }

    // 净化URL
    const sanitizedUrl = URLValidator.sanitizeInput(url);
    logger.info(`检测到${platformName}视频...`);
    
    // 创建下载目录
    const downloadDir = join(process.cwd(), config.downloadPath);
    await mkdir(downloadDir, { recursive: true });

    logger.info('获取视频信息...');
    const info = await downloader.getVideoInfo(sanitizedUrl);
    logger.info(`视频标题: ${info.title}`);
    logger.info(`视频时长: ${Math.floor(info.duration / 60)}分${info.duration % 60}秒`);

    logger.info('开始下载视频...');
    await downloader.startDownload(sanitizedUrl, {
      outputPath: downloadDir,
      onProgress: (progress) => {
        process.stdout.write(`\r下载进度: ${progress}%`);
      }
    });
    process.stdout.write('\n');
    logger.info('下载完成！');
  } catch (error) {
    logger.error('下载失败:', error);
  }
}

async function startServer() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  showBanner();

  rl.on('line', async (input) => {
    const cmd = input.toLowerCase();
    if (cmd === 'exit') {
      logger.info('正在关闭程序...');
      rl.close();
      process.exit(0);
    }
    
    if (cmd === 'clear') {
      console.clear();
      showBanner();
      return;
    }

    const inputUrl = input.trim();
    if (inputUrl) {
      await downloadVideo(inputUrl);
      logger.info('\n准备下载下一个视频...');
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

async function main() {
  try {
    logger.info('视频下载器启动');

    const url = process.argv[2];
    if (url) {
      await downloadVideo(url);
      process.exit(0);
    } else if (config.autoStartServer) {
      await startServer();
    } else {
      logger.error('请提供视频URL');
      logger.info('使用方法: npm start [视频URL]');
      process.exit(1);
    }
  } catch (error) {
    logger.error('程序运行出错:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('未捕获的错误:', error);
  process.exit(1);
});
