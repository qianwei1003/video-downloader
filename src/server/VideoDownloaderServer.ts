import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { BatchDownloadOptions } from '../types/downloader.js';
import express from 'express';
import cors from 'cors';
import { AppConfig } from '../types/config.js';
import { Config } from '../types/index.js';
import { DownloadService } from '../services/DownloadService.js';
import { DownloadController } from '../controllers/DownloadController.js';
import { convertConfig } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { DownloaderService } from '../services/DownloaderService.js';
import { MediaInfoService } from '../services/MediaInfoService.js';

export class VideoDownloaderServer {
  private server: Server;
  private downloaderService: DownloaderService;
  private mediaInfoService: MediaInfoService;
  private expressApp: express.Application;
  private downloadService: DownloadService;

  constructor(private config: AppConfig) {
    // 初始化MCP服务器
    this.server = new Server(
      {
        name: 'video-downloader',
        version: config.version || '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    // 转换配置格式
    const serviceConfig: Config = convertConfig(config);
    // 初始化服务
    this.downloaderService = new DownloaderService(config);
    this.mediaInfoService = new MediaInfoService(config);
    this.downloadService = new DownloadService(serviceConfig);
    
    // 设置Express应用程序
    this.expressApp = express();
    this.setupExpressApp();
    
    // 设置MCP工具处理程序
    this.setupToolHandlers();
    this.setupErrorHandler();
  }
  
  public async testBatchDownload() {
    const urls = [
      'https://www.bilibili.com/video/BV1Xx411c7mD',
      'https://www.bilibili.com/video/BV1Yx411c7mE',
      'https://www.bilibili.com/video/BV1Zx411c7mF'
    ];
    const result = await this.downloaderService.handleBatchDownload({
      urls,
      format: 'mp4',
      outputDir: './downloads',
      noPlaylist: true,
      audioOnly: false,
      subtitles: false,
      speedLimit: '1M'
    });
    console.log(result);
  }
  private setupExpressApp() {
    // 启用CORS和JSON请求体解析
    this.expressApp.use(cors());
    this.expressApp.use(express.json());
    
    // 初始化控制器
    const downloadController = new DownloadController(this.downloadService);
    
    // 设置API路由
    this.expressApp.post('/api/download', downloadController.createTask);
    this.expressApp.get('/api/tasks', downloadController.getAllTasks);
    this.expressApp.get('/api/tasks/:id', downloadController.getTask);
    this.expressApp.delete('/api/tasks/:id', downloadController.cancelTask);
    
    // B站热门视频接口
    this.expressApp.get('/api/bilibili/popular', async (req, res) => {
      try {
        const result = await this.downloaderService.getBilibiliPopularVideos();
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: '获取B站热门视频失败',
          message: error instanceof Error ? error.message : '未知错误'
        });
      }
    });

    // 抖音热门视频接口
    this.expressApp.get('/api/douyin/popular', async (req, res) => {
      try {
        const result = await this.downloaderService.getDouyinPopularVideos();
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error: '获取抖音热门视频失败',
          message: error instanceof Error ? error.message : '未知错误'
        });
      }
    });
  }

  private setupErrorHandler() {
    this.server.onerror = (error) => {
      logger.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      logger.info('正在关闭服务器...');
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.registerListToolsHandler();
    this.registerCallToolHandler();
  }

  private registerListToolsHandler() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'download_video',
          description: '使用 yt-dlp 下载视频',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: '视频URL',
              },
              format: {
                type: 'string',
                description: '视频格式 (例如: "best", "mp4", "720p")',
              },
              outputDir: {
                type: 'string',
                description: '下载目录路径',
              },
              noPlaylist: {
                type: 'boolean',
                description: '设置为true只下载单个视频而非整个播放列表',
              },
              videoId: {
                type: 'string',
                description: '指定具体要下载的视频ID',
              },
              audioOnly: {
                type: 'boolean',
                description: '只提取音频',
              },
              subtitles: {
                type: 'boolean',
                description: '下载字幕',
              },
              speedLimit: {
                type: 'string',
                description: '下载速度限制 (例如: "50K", "1M")',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'get_media_info',
          description: '获取媒体信息',
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
          name: 'list_downloads',
          description: '列出已下载的视频',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: '可选，指定目录路径',
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
          name: 'get_douyin_popular_videos',
          description: '获取抖音播放量较高的视频地址集合',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_bilibili_popular_videos',
          description: '获取B站播放量较高的视频地址集合',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'get_task_status',
          description: '获取下载任务的状态',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'string',
                description: '下载任务ID'
              }
            },
            required: ['taskId']
          },
        },
        {
          name: 'batch_download_videos',
          description: '批量下载多个视频',
          inputSchema: {
            type: 'object',
            properties: {
              urls: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: '视频URL列表',
              },
              format: {
                type: 'string',
                description: '视频格式 (例如: "best", "mp4", "720p")',
              },
              outputDir: {
                type: 'string',
                description: '下载目录路径',
              },
              noPlaylist: {
                type: 'boolean',
                description: '设置为true只下载单个视频而非整个播放列表',
              },
              audioOnly: {
                type: 'boolean',
                description: '只提取音频',
              },
              subtitles: {
                type: 'boolean',
                description: '下载字幕',
              },
              speedLimit: {
                type: 'string',
                description: '下载速度限制 (例如: "50K", "1M")',
              },
            },
            required: ['urls'],
          },
        },
      ],
    }));
  }

  private registerCallToolHandler() {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch(request.params.name) {
        case 'download_video': {
          if (!request.params.arguments || typeof request.params.arguments !== 'object') {
            throw new McpError(ErrorCode.InvalidParams, '无效的下载参数');
          }
          return await this.downloaderService.handleDownload(request.params.arguments);
        }
        case 'get_media_info': {
          if (!request.params.arguments || typeof request.params.arguments !== 'object') {
            throw new McpError(ErrorCode.InvalidParams, '无效的媒体信息参数');
          }
          const { url } = request.params.arguments as { url?: string };
          if (!url || typeof url !== 'string') {
            throw new McpError(ErrorCode.InvalidParams, '需要提供有效的URL');
          }
          return await this.mediaInfoService.getMediaInfo(url);
        }
        case 'list_downloads': {
          if (request.params.arguments && typeof request.params.arguments !== 'object') {
            throw new McpError(ErrorCode.InvalidParams, '无效的列表参数');
          }
          const { path } = (request.params.arguments || {}) as { path?: string };
          return await this.downloaderService.listDownloads(path);
        }
        case 'download_douyin_video': {
          if (!request.params.arguments || typeof request.params.arguments !== 'object') {
            throw new McpError(ErrorCode.InvalidParams, '无效的下载参数');
          }
          return await this.downloaderService.handleDownload(request.params.arguments);
        }
        case 'get_douyin_popular_videos': {
          return await this.downloaderService.getDouyinPopularVideos();
        }
        case 'get_bilibili_popular_videos': {
          return await this.downloaderService.getBilibiliPopularVideos();
        }
        case 'get_task_status': {
          if (!request.params.arguments || typeof request.params.arguments !== 'object') {
            throw new McpError(ErrorCode.InvalidParams, '无效的参数');
          }
          
          const { taskId } = request.params.arguments as { taskId?: string };
          if (!taskId) {
            throw new McpError(ErrorCode.InvalidParams, '需要提供任务ID');
          }

          const status = this.downloaderService.getTaskStatus(taskId);
          if (!status) {
            throw new McpError(ErrorCode.InvalidParams, '找不到指定的下载任务');
          }

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(status)
            }]
          };
        }
        case 'batch_download_videos': {
          if (!request.params.arguments || typeof request.params.arguments !== 'object') {
            throw new McpError(ErrorCode.InvalidParams, '无效的批量下载参数');
          }
          
          const { urls, format, outputDir, noPlaylist, audioOnly, subtitles, speedLimit } = request.params.arguments as Record<string, any>;
          
          if (!Array.isArray(urls) || urls.length === 0) {
            throw new McpError(ErrorCode.InvalidParams, '需要提供有效的URL列表');
          }

          const batchOptions: BatchDownloadOptions = {
            urls,
            format,
            outputDir,
            noPlaylist,
            audioOnly,
            subtitles,
            speedLimit
          };

          return await this.downloaderService.handleBatchDownload(batchOptions);
        }
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `未知工具: ${request.params.name}`
          );
      }
    });
  }

  async run() {
    // 启动Express服务器
    const port = this.config.apiPort || 3000;
    const host = this.config.apiHost || 'localhost';
    
    this.expressApp.listen(port, host, () => {
      logger.info(`RESTful API 服务器运行在 http://${host}:${port}/`);
    });

    // 启动MCP服务器
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP 服务器已连接');
  }
}
