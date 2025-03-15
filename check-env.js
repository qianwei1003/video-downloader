#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('检查运行环境...');

// 检查Node.js版本
const nodeVersion = process.version;
console.log(`Node.js版本: ${nodeVersion}`);
const requiredNodeVersion = 'v16.0.0';
if (nodeVersion.localeCompare(requiredNodeVersion, undefined, { numeric: true }) < 0) {
  console.error(`警告: 推荐使用 Node.js ${requiredNodeVersion} 或更高版本`);
}

// 检查yt-dlp是否安装
try {
  const ytDlpVersion = execSync('yt-dlp --version', { encoding: 'utf8' }).trim();
  console.log(`yt-dlp版本: ${ytDlpVersion}`);
} catch (error) {
  console.error('错误: yt-dlp 未安装或不在PATH中');
  console.log('请从 https://github.com/yt-dlp/yt-dlp 安装yt-dlp');
  process.exit(1);
}

// 检查必要的目录
const requiredDirs = ['downloads', 'downloads/logs'];
for (const dir of requiredDirs) {
  const dirPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(dirPath)) {
    console.log(`创建目录: ${dir}`);
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 检查配置文件
const configPath = path.join(process.cwd(), 'config.json');
if (!fs.existsSync(configPath)) {
  console.log('配置文件不存在，创建默认配置文件...');
  const defaultConfig = {
    version: '0.2.0',
    defaultOutputDir: './downloads',
    logLevel: 'info',
    maxConcurrentDownloads: 2,
    apiPort: 3000,
    apiHost: 'localhost'
  };
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  console.log(`创建了默认配置文件: ${configPath}`);
}

console.log('环境检查完成！系统可以运行。');
