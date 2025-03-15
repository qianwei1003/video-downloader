#!/usr/bin/env node
import { VideoDownloaderServer } from './server/VideoDownloaderServer.js';
import { initLogger } from './utils/logger.js';
import { loadConfig } from './config/index.js';

async function main() {
  // 初始化日志系统
  initLogger();
  
  // 加载配置
  const config = await loadConfig();
  
  // 启动服务器
  const server = new VideoDownloaderServer(config);
  await server.run();
  
  console.error('视频下载 MCP 服务器正在运行');
}

main().catch(err => {
  console.error('服务启动失败:', err);
  process.exit(1);
});
