#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { getVideoInfo, downloadVideo, batchDownload, taskManager } from './services/bilibili.js';
import { playwrightSearch } from './services/playwright-search.js';
import { CallToolRequest } from './types/bilibili.js';

class BilibiliServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'bilibili-downloader',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    this.server.onerror = (error: Error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search',
          description: '搜索B站视频',
          inputSchema: {
            type: 'object',
            properties: {
              keyword: {
                type: 'string',
                description: '搜索关键词'
              },
              page: {
                type: 'number',
                description: '页码',
                default: 1
              },
              pageSize: {
                type: 'number',
                description: '每页结果数',
                default: 20
              },
              order: {
                type: 'string',
                enum: ['pubdate', 'click', 'scores'],
                description: '排序方式: 发布时间/播放量/综合评分',
                default: 'scores'
              }
            },
            required: ['keyword']
          },
        },
        {
          name: 'video-info',
          description: '获取B站视频信息，包括标题、作者、时长等',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'B站视频URL'
              }
            },
            required: ['url']
          },
        },
        {
          name: 'download',
          description: '下载B站视频',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'B站视频URL'
              },
              quality: {
                type: 'string',
                description: '视频质量(360p/480p/720p/1080p)',
                enum: ['360p', '480p', '720p', '1080p'],
                default: '720p'
              },
              output: {
                type: 'string',
                description: '输出文件路径（可选）'
              }
            },
            required: ['url']
          },
        },
        {
          name: 'batch-download',
          description: '批量下载B站视频',
          inputSchema: {
            type: 'object',
            properties: {
              urls: {
                type: 'array',
                items: {
                  type: 'string'
                },
                description: 'B站视频URL列表'
              },
              quality: {
                type: 'string',
                description: '视频质量(360p/480p/720p/1080p)',
                enum: ['360p', '480p', '720p', '1080p'],
                default: '720p'
              },
              outputDir: {
                type: 'string',
                description: '输出目录路径（可选）'
              },
              concurrency: {
                type: 'number',
                description: '同时下载的最大任务数（可选，默认3）',
                minimum: 1,
                maximum: 5,
                default: 3
              }
            },
            required: ['urls']
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;

      try {
        if (name === 'video-info') {
          if (!args.url) {
            throw new Error('URL is required for video-info');
          }
          const info = await getVideoInfo(args.url);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(info, null, 2),
              },
            ],
          };
        } else if (name === 'download') {
          if (!args.url) {
            throw new Error('URL is required for download');
          }
          const outputPath = await downloadVideo(args.url, {
            quality: args.quality,
            output: args.output,
          });
          return {
            content: [
              {
                type: 'text',
                text: `Video downloaded successfully to: ${outputPath}`,
              },
            ],
          };
        } else if (name === 'batch-download') {
          if (!args.urls || !Array.isArray(args.urls)) {
            throw new Error('URLs array is required for batch-download');
          }
          const tasks = await batchDownload({
            urls: args.urls,
            quality: args.quality,
            outputDir: args.outputDir,
            concurrency: args.concurrency,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(tasks.map(t => ({
                  id: t.id,
                  url: t.url,
                  status: t.status.status,
                })), null, 2),
              },
            ],
          };
        } else if (name === 'search') {
          if (!args.keyword) {
            throw new Error('搜索关键词不能为空');
          }
          try {
            console.log('开始搜索视频:', args.keyword);
            const results = await playwrightSearch.search(
              args.keyword, 
              args.order || 'scores'
            );
            console.log('搜索结果数量:', results.length);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(results, null, 2),
                },
              ],
            };
          } catch (searchError) {
            console.error('搜索失败:', searchError);
            throw new Error(`搜索失败: ${searchError instanceof Error ? searchError.message : String(searchError)}`);
          }
        } else {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
        }
      } catch (error) {
        console.error('MCP工具执行错误:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error && error.stack) {
          console.error('错误堆栈:', error.stack);
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Bilibili MCP server running on stdio');
  }
}

const server = new BilibiliServer();
server.run().catch(console.error);
