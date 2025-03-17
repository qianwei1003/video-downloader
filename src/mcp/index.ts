#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/dist/esm/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/dist/esm/shared/transport';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/dist/esm/shared/schema';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/dist/esm/shared/error';
import type { Request as McpRequest, ServerConfig as McpServerConfig } from '@modelcontextprotocol/sdk/dist/esm/types';
import { DownloadManager } from '../core/downloader/DownloadManager';
import { BatchDownloadManager } from '../core/downloader/BatchDownloadManager';
import { configLoader } from '../lib/config';
import { Logger } from '../lib/logger';
import { URLValidator } from '../utils/validator';
import { join } from 'path';
import { mkdir, readdir, stat } from 'fs/promises';

const logger = new Logger();
const config = configLoader.getConfig();
const downloader = new DownloadManager();
const batchDownloader = new BatchDownloadManager();

interface SingleDownloadArgs {
  url: string;
}

interface BatchDownloadArgs {
  urls: string[];
}

class VideoDownloaderServer {
  private server: Server;

  constructor() {
    const config: McpServerConfig = {
      name: 'video-downloader-server',
      version: '0.1.0',
    };
    
    this.server = new Server(config, {
      capabilities: {
        tools: {},
      },
    });

    this.setupToolHandlers();
    
    // 错误处理
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      content: [
        {
          type: 'application/json',
          text: JSON.stringify({
            tools: [
              {
                name: 'download_video',
                description: '下载单个视频',
                inputSchema: {
                  type: 'object',
                  properties: {
                    url: {
                      type: 'string',
                      description: '视频URL',
                    },
                  },
                  required: ['url'],
                },
              },
              {
                name: 'batch_download_videos',
                description: '批量下载视频',
                inputSchema: {
                  type: 'object',
                  properties: {
                    urls: {
                      type: 'array',
                      items: {
                        type: 'string',
                      },
                      description: '视频URL列表',
                    },
                  },
                  required: ['urls'],
                },
              },
              {
                name: 'get_media_info',
                description: '获取视频信息',
                inputSchema: {
                  type: 'object',
                  properties: {
                    url: {
                      type: 'string',
                      description: '视频URL',
                    },
                  },
                  required: ['url'],
                },
              },
              {
                name: 'get_bilibili_popular_videos',
                description: '获取B站热门视频',
                inputSchema: {
                  type: 'object',
                  properties: {
                    count: {
                      type: 'number',
                      description: '获取数量',
                      default: 20
                    },
                  },
                },
              },
              {
                name: 'get_douyin_popular_videos',
                description: '获取抖音热门视频',
                inputSchema: {
                  type: 'object',
                  properties: {
                    count: {
                      type: 'number',
                      description: '获取数量',
                      default: 20
                    },
                  },
                },
              },
              {
                name: 'list_downloads',
                description: '列出已下载的视频',
                inputSchema: {
                  type: 'object',
                  properties: {
                    limit: {
                      type: 'number',
                      description: '列出数量限制',
                      default: 10
                    },
                  },
                },
              },
              {
                name: 'download_douyin_video',
                description: '下载抖音视频',
                inputSchema: {
                  type: 'object',
                  properties: {
                    url: {
                      type: 'string',
                      description: '抖音视频URL',
                    },
                  },
                  required: ['url'],
                },
              },
              {
                name: 'get_task_status',
                description: '获取下载任务状态',
                inputSchema: {
                  type: 'object',
                  properties: {
                    taskId: {
                      type: 'string',
                      description: '任务ID',
                    },
                  },
                  required: ['taskId'],
                },
              },
            ],
          }, null, 2)
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: McpRequest) => {
      if (!request.params?.name || !request.params?.arguments) {
        throw new McpError(ErrorCode.InvalidParams, '无效的请求参数');
      }

      switch (request.params.name) {
        case 'download_video':
          return this.handleSingleDownload(request.params.arguments as SingleDownloadArgs);
        case 'batch_download_videos':
          return this.handleBatchDownload(request.params.arguments as BatchDownloadArgs);
        case 'get_media_info':
          return this.handleGetMediaInfo(request.params.arguments as SingleDownloadArgs);
        case 'get_bilibili_popular_videos':
          return this.handleGetBilibiliPopularVideos(request.params.arguments as {count?: number});
        case 'get_douyin_popular_videos':
          return this.handleGetDouyinPopularVideos(request.params.arguments as {count?: number});
        case 'list_downloads':
          return this.handleListDownloads(request.params.arguments as {limit?: number});
        case 'download_douyin_video':
          return this.handleDouyinDownload(request.params.arguments as SingleDownloadArgs);
        case 'get_task_status':
          return this.handleGetTaskStatus(request.params.arguments as {taskId: string});
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `未知工具: ${request.params.name}`
          );
      }
    });
  }

  private async handleSingleDownload(args: SingleDownloadArgs) {
    try {
      if (!URLValidator.isValidUrl(args.url)) {
        throw new McpError(ErrorCode.InvalidParams, '无效的URL');
      }

      const platformName = URLValidator.getPlatformName(args.url);
      if (!platformName) {
        throw new McpError(ErrorCode.InvalidParams, '不支持的平台');
      }

      const sanitizedUrl = URLValidator.sanitizeInput(args.url);
      const downloadDir = join(process.cwd(), config.downloadPath);
      await mkdir(downloadDir, { recursive: true });

      const info = await downloader.getVideoInfo(sanitizedUrl);
      await downloader.startDownload(sanitizedUrl, {
        outputPath: downloadDir,
        onProgress: (progress) => {
          process.stdout.write(`\r下载进度: ${progress}%`);
        }
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: '下载完成',
              info: {
                title: info.title,
                duration: info.duration,
                platform: platformName
              }
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `下载失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleBatchDownload(args: BatchDownloadArgs) {
    try {
      if (!Array.isArray(args.urls) || args.urls.length === 0) {
        throw new McpError(ErrorCode.InvalidParams, 'URLs列表不能为空');
      }

      const downloadDir = join(process.cwd(), config.downloadPath);
      await mkdir(downloadDir, { recursive: true });

      const results = await batchDownloader.download(args.urls, {
        outputPath: downloadDir,
        onProgress: (url, progress) => {
          process.stdout.write(`\r${url} 下载进度: ${progress}%`);
        }
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: '批量下载完成',
              results: results.map(result => ({
                url: result.url,
                success: result.success,
                message: result.message,
                info: result.info ? {
                  title: result.info.title,
                  duration: result.info.duration,
                  platform: URLValidator.getPlatformName(result.url)
                } : null
              }))
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `批量下载失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleGetMediaInfo(args: SingleDownloadArgs) {
    try {
      if (!URLValidator.isValidUrl(args.url)) {
        throw new McpError(ErrorCode.InvalidParams, '无效的URL');
      }

      const platformName = URLValidator.getPlatformName(args.url);
      if (!platformName) {
        throw new McpError(ErrorCode.InvalidParams, '不支持的平台');
      }

      const sanitizedUrl = URLValidator.sanitizeInput(args.url);
      const info = await downloader.getVideoInfo(sanitizedUrl);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              info: {
                title: info.title,
                duration: info.duration,
                platform: platformName
              }
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `获取视频信息失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleGetBilibiliPopularVideos(args: {count?: number}) {
    try {
      const platform = downloader.getPlatform('https://www.bilibili.com');
      if (!platform) {
        throw new McpError(ErrorCode.InternalError, '未找到B站平台支持');
      }

      const count = args.count || 20;
      const videos = await platform.getPopularVideos(count);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              videos
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `获取B站热门视频失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleGetDouyinPopularVideos(args: {count?: number}) {
    try {
      const platform = downloader.getPlatform('https://www.douyin.com');
      if (!platform) {
        throw new McpError(ErrorCode.InternalError, '未找到抖音平台支持');
      }

      const count = args.count || 20;
      const videos = await platform.getPopularVideos(count);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              videos
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `获取抖音热门视频失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleListDownloads(args: {limit?: number}) {
    try {
      const downloadDir = join(process.cwd(), config.downloadPath);
      const limit = args.limit || 10;
      
      const files = await readdir(downloadDir);
      const downloads = await Promise.all(
        files.slice(0, limit).map(async (filename: string) => {
          const filePath = join(downloadDir, filename);
          const stats = await stat(filePath);
          return {
            filename: filename,
            size: stats.size,
            downloadedAt: stats.mtime
          };
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              downloads
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `获取下载列表失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleDouyinDownload(args: SingleDownloadArgs) {
    try {
      if (!URLValidator.isValidUrl(args.url)) {
        throw new McpError(ErrorCode.InvalidParams, '无效的抖音URL');
      }

      const platformName = URLValidator.getPlatformName(args.url);
      if (platformName !== 'douyin') {
        throw new McpError(ErrorCode.InvalidParams, '非抖音视频链接');
      }

      const sanitizedUrl = URLValidator.sanitizeInput(args.url);
      const downloadDir = join(process.cwd(), config.downloadPath);
      await mkdir(downloadDir, { recursive: true });

      const info = await downloader.getVideoInfo(sanitizedUrl);
      await downloader.startDownload(sanitizedUrl, {
        outputPath: downloadDir,
        onProgress: (progress) => {
          process.stdout.write(`\r下载进度: ${progress}%`);
        }
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: '抖音视频下载完成',
              info: {
                title: info.title,
                duration: info.duration
              }
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `抖音视频下载失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleGetTaskStatus(args: {taskId: string}) {
    try {
      const taskStatus = await batchDownloader.getTaskStatus(args.taskId);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              status: taskStatus
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `获取任务状态失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async run() {
    try {
      console.error('正在创建 StdioServerTransport...');
      const transport = new StdioServerTransport();

      console.error('正在连接到传输层...');
      await this.server.connect(transport);
      
      console.error('视频下载MCP服务器运行中...');
      console.error('进程ID:', process.pid);
      console.error('工作目录:', process.cwd());
    } catch (error) {
      console.error('服务器启动失败:', error);
      throw error;
    }
  }
}

const server = new VideoDownloaderServer();
server.run().catch(console.error);
