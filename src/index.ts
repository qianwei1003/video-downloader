#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { exec } from 'yt-dlp-exec';

interface DownloadArgs {
  url: string;
  format?: string;
  output?: string;
}

class VideoDownloaderServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'video-downloader',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {
            download_video: {
              description: '从YouTube或其他支持的平台下载视频',
              schema: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description: '视频URL',
                  },
                  format: {
                    type: 'string',
                    description: '视频格式 (默认: best)',
                  },
                  output: {
                    type: 'string',
                    description: '输出文件名',
                  },
                },
                required: ['url'],
              }
            },
            get_video_info: {
              description: '获取视频信息',
              schema: {
                type: 'object',
                properties: {
                  url: {
                    type: 'string',
                    description: '视频URL',
                  },
                },
                required: ['url'],
              }
            }
          },
        },
      }
    );

    this.setupHandlers();
    
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers() {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const args = request.params.arguments as any;
      switch (request.params.name) {
        case 'download_video':
          return this.handleDownloadVideo(args as DownloadArgs);
        case 'get_video_info':
          return this.handleGetVideoInfo(args as { url: string });
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            '未知工具: ' + request.params.name
          );
      }
    });
  }

  private async handleDownloadVideo(args: DownloadArgs) {
    try {
      const result = await exec(args.url, {
        format: args.format || 'best',
        output: args.output,
      });

      return {
        content: [
          {
            type: 'text',
            text: `视频下载成功:\n${result}`,
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `下载失败: ${error.message || '未知错误'}`
      );
    }
  }

  private async handleGetVideoInfo(args: { url: string }) {
    try {
      const result = await exec(args.url, {
        dumpJson: true,
      });

      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `获取信息失败: ${error.message || '未知错误'}`
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('视频下载MCP服务器正在运行...');
  }
}

const server = new VideoDownloaderServer();
server.run().catch(console.error);
