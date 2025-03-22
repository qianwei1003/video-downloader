import axios, { AxiosResponse } from 'axios';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { VideoInfo, DownloadOptions, DownloadTask, TaskStatus, BatchDownloadOptions, SearchOptions, SearchResult } from '../types/bilibili.js';
import { v4 as uuidv4 } from 'uuid';
import { configManager } from '../config/settings.js';

function formatFilename(title: string, quality: string, format: string): string {
  return format
    .replace('{title}', title)
    .replace('{quality}', quality)
    .replace(/[<>:"/\\|?*]/g, '_') + '.mp4';
}

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
  
  taskManager = new TaskManager(concurrency);
  
  const settings = configManager.getDownloadSettings();
  const targetDir = outputDir || settings.defaultDir;
  await mkdir(targetDir, { recursive: true });
  
  const tasks = await Promise.all(
    urls.map(async (url) => {
      const info = await getVideoInfo(url);
      const quality = downloadOptions.quality || '720p';
      const filename = formatFilename(info.title, quality, settings.filenameFormat);
      const taskOptions: DownloadOptions = {
        ...downloadOptions,
        output: path.join(targetDir, settings.createSubDirs ? new Date().toISOString().split('T')[0] : '', filename)
      };
      return taskManager.addTask(url, taskOptions);
    })
  );
  
  return tasks;
}

async function getVideoTitle(url: string): Promise<string> {
  const info = await getVideoInfo(url);
  return info.title.replace(/[<>:"/\\|?*]/g, '_');
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

    const settings = configManager.getDownloadSettings();
    const info = await getVideoInfo(url);
    const quality = options.quality || '720p';
    const filename = formatFilename(info.title, quality, settings.filenameFormat);
    
    const outputPath = options.output || path.join(
      settings.defaultDir,
      settings.createSubDirs ? new Date().toISOString().split('T')[0] : '',
      filename
    );
    
    const playUrl = await getPlayUrl(bvid, quality);
    
    const response = await axios({
      method: 'GET',
      url: playUrl,
      responseType: 'stream',
      headers: {
        'Referer': 'https://www.bilibili.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    await mkdir(path.dirname(outputPath), { recursive: true });
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

export async function searchVideos(options: SearchOptions): Promise<SearchResult[]> {
  try {
    const { keyword, page = 1, pageSize = 20, order = 'scores' } = options;
    
    try {
      console.log('开始搜索视频:', keyword);
      const searchUrl = new URL('https://api.bilibili.com/x/web-interface/wbi/search/type');
      searchUrl.searchParams.set('search_type', 'video');
      searchUrl.searchParams.set('__refresh__', Date.now().toString());
      searchUrl.searchParams.set('keyword', keyword);
      searchUrl.searchParams.set('page', page.toString());
      searchUrl.searchParams.set('order', order);
      searchUrl.searchParams.set('duration', '0');
      searchUrl.searchParams.set('tids', '0');
      searchUrl.searchParams.set('category_id', '');

      const response = await axios.get(searchUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Referer': 'https://search.bilibili.com',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://search.bilibili.com',
          'Cookie': `buvid3=${Math.random().toString(36).substring(2)};CURRENT_FNVAL=4048;b_nut=${Date.now()};`,
          'Accept-Language': 'zh-CN,zh;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive'
        },
        timeout: 10000
      });

      console.log('API响应状态:', response.status);

      if (response.data.code !== 0) {
        throw new Error(`搜索API返回错误: ${response.data.message || '未知错误'}`);
      }

      if (!response.data.data?.result || !Array.isArray(response.data.data.result)) {
        console.log('API返回数据无结果');
        return [];
      }

      const results = (response.data.data?.result || []).slice(0, pageSize).map((item: any) => ({
        id: item.bvid,
        title: (item.title || '').replace(/<[^>]+>/g, ''),
        author: item.author || '',
        duration: item.duration || '',
        views: parseInt((item.play || '0').toString().replace(/[^0-9]/g, ''), 10),
        pubDate: item.pubdate ? new Date(item.pubdate * 1000).toISOString() : new Date().toISOString()
      }));

      console.log(`处理完成，找到 ${results.length} 个视频`);
      return results;
    } catch (error) {
      console.error('搜索失败:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`搜索视频失败: ${error.message}`);
    }
    throw error;
  }
}

async function getPlayUrl(bvid: string, quality: string): Promise<string> {
  const cidResponse = await axios.get(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`);
  if (cidResponse.data.code !== 0) {
    throw new Error(cidResponse.data.message || 'Failed to get video CID');
  }
  const cid = cidResponse.data.data.cid;

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
