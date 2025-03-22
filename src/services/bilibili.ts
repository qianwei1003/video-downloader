import axios, { AxiosResponse } from 'axios';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { VideoInfo, DownloadOptions, DownloadTask, TaskStatus, BatchDownloadOptions, SearchOptions, SearchResult } from '../types/bilibili.js';
import { v4 as uuidv4 } from 'uuid';

class TaskManager {
  private queue: DownloadTask[] = [];
  private running = new Set<string>();
  private maxConcurrent: number;

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  async addTask(url: string, options: DownloadOptions): Promise<DownloadTask> {
    const task: DownloadTask = {
      id: uuidv4(),
      url,
      options,
      status: {
        id: uuidv4(),
        status: 'pending',
        progress: 0
      }
    };
    this.queue.push(task);
    this.processQueue();
    return task;
  }

  private async processQueue(): Promise<void> {
    if (this.queue.length === 0 || this.running.size >= this.maxConcurrent) {
      return;
    }

    const task = this.queue.find(t => t.status.status === 'pending');
    if (!task) return;

    this.running.add(task.id);
    task.status.status = 'downloading';

    try {
      const result = await downloadVideo(task.url, task.options);
      task.status.status = 'completed';
      task.status.message = `Downloaded to: ${result}`;
    } catch (error) {
      task.status.status = 'failed';
      task.status.message = error instanceof Error ? error.message : String(error);
    } finally {
      this.running.delete(task.id);
      this.processQueue();
    }
  }

  getTaskStatus(taskId: string): TaskStatus | undefined {
    const task = this.queue.find(t => t.id === taskId);
    return task?.status;
  }

  getAllTasks(): DownloadTask[] {
    return [...this.queue];
  }
}

let taskManager = new TaskManager();

export async function batchDownload(options: BatchDownloadOptions): Promise<DownloadTask[]> {
  const { urls, concurrency = 3, outputDir, ...downloadOptions } = options;
  
  // 重置任务管理器的并发数
  taskManager = new TaskManager(concurrency);
  
  // 创建输出目录
  if (outputDir) {
    await mkdir(outputDir, { recursive: true });
  }
  
  // 添加所有下载任务
  const tasks = await Promise.all(
    urls.map(async (url) => {
      const taskOptions: DownloadOptions = {
        ...downloadOptions,
        output: outputDir ? path.join(outputDir, `${await getVideoTitle(url)}.mp4`) : undefined
      };
      return taskManager.addTask(url, taskOptions);
    })
  );
  
  return tasks;
}

async function getVideoTitle(url: string): Promise<string> {
  const info = await getVideoInfo(url);
  return info.title.replace(/[<>:"/\\|?*]/g, '_'); // 替换非法文件名字符
}

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  try {
    const bvid = url.match(/BV[a-zA-Z0-9]+/)?.[0];
    if (!bvid) {
      throw new Error('Invalid Bilibili URL');
    }

    const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
    const response = await axios.get(apiUrl);
    const data = response.data;

    if (data.code !== 0) {
      throw new Error(data.message || 'Failed to fetch video info');
    }

    return {
      title: data.data.title,
      author: data.data.owner.name,
      duration: formatDuration(data.data.duration),
      quality: ['360p', '480p', '720p', '1080p']
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get video info: ${error.message}`);
    }
    throw error;
  }
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export async function downloadVideo(url: string, options: DownloadOptions = {}): Promise<string> {
  try {
    const bvid = url.match(/BV[a-zA-Z0-9]+/)?.[0];
    if (!bvid) {
      throw new Error('Invalid Bilibili URL');
    }

    // 获取视频信息
    const info = await getVideoInfo(url);
    
    // 确定输出路径
    const outputPath = options.output || path.join(process.cwd(), `${info.title}.mp4`);
    
    // 获取视频流URL
    const playUrl = await getPlayUrl(bvid, options.quality || '720p');
    
    // 下载视频流
    const response = await axios({
      method: 'GET',
      url: playUrl,
      responseType: 'stream',
      headers: {
        'Referer': 'https://www.bilibili.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // 确保输出目录存在
    await mkdir(path.dirname(outputPath), { recursive: true });
    
    // 将视频流写入文件
    const writer = createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(outputPath));
      writer.on('error', reject);
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to download video: ${error.message}`);
    }
    throw error;
  }
}

import { playwrightSearch } from './playwright-search.js';

export async function searchVideos(options: SearchOptions): Promise<SearchResult[]> {
  try {
    const { keyword, page = 1, pageSize = 20, order = 'scores' } = options;
    
    try {
      // 首先尝试使用API搜索
      const params = {
        keyword,
        page,
        pagesize: pageSize,
        order,
        search_type: 'video',
      };

      const response: AxiosResponse = await axios.get('https://app.bilibili.com/x/v2/search/type', {
        params: {
          ...params,
          device: 'phone',
          from_source: 'app_search',
          from: 'search',
          type: 1,
          plat: 2
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BiliApp/7.12.0',
          'Accept': 'application/json',
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'Origin': 'https://app.bilibili.com',
          'Referer': 'https://app.bilibili.com',
          'Connection': 'keep-alive'
        }
      });

      if (response.data.code !== 0) {
        throw new Error(response.data.message || '搜索失败');
      }

      const results = response.data.data.result || [];
      return results.map((item: any) => ({
        id: item.bvid,
        title: item.title.replace(/<[^>]+>/g, ''), // 移除HTML标签
        author: item.author,
        duration: item.duration,
        views: item.play,
        pubDate: new Date(item.pubdate * 1000).toISOString()
      }));
    } catch (apiError) {
      console.log('API搜索失败，切换到浏览器模式...');
      // API搜索失败时，使用Playwright进行浏览器搜索
      return await playwrightSearch.search(keyword);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`搜索视频失败: ${error.message}`);
    }
    throw error;
  }
}

async function getPlayUrl(bvid: string, quality: string): Promise<string> {
  // 首先获取视频的cid
  const cidResponse = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
  if (cidResponse.data.code !== 0) {
    throw new Error(cidResponse.data.message || 'Failed to get video CID');
  }
  const cid = cidResponse.data.data.cid;

  // 获取播放URL
  const qnMap: Record<string, number> = {
    '1080p': 80,
    '720p': 64,
    '480p': 32,
    '360p': 16
  };

  const response = await axios.get(
    `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=${qnMap[quality]}&type=&otype=json`,
    {
      headers: {
        'Referer': 'https://www.bilibili.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    }
  );
  
  const data = response.data;
  if (data.code !== 0) {
    throw new Error(data.message || 'Failed to get play URL');
  }

  if (!data.data?.durl?.[0]?.url) {
    throw new Error('Video URL not found');
  }

  return data.data.durl[0].url;
}

export { TaskManager, taskManager };
