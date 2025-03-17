import axios from 'axios';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { IPlatform, VideoInfo, VideoFormat, DownloadOptions, AdvancedDownloadOptions, PopularVideo } from '@core/platform/IPlatform';
import { Logger } from '@lib/logger';
import { getPlatformConfig } from '@lib/config/platforms';

export class BilibiliPlatform implements IPlatform {
  private logger: Logger;
  private readonly API_BASE = 'https://api.bilibili.com/x';
  private readonly config: any;

  constructor() {
    this.logger = new Logger();
    this.config = getPlatformConfig('bilibili');
    if (!this.config) {
      throw new Error('未找到Bilibili平台配置');
    }
  }

  getName(): string {
    return 'Bilibili';
  }

  isSupported(url: string): boolean {
    return /bilibili\.com\/video\/([A-Za-z0-9]+)/.test(url);
  }

  private extractBvid(url: string): string {
    const match = url.match(/\/video\/([A-Za-z0-9]+)/);
    if (!match) throw new Error('无效的B站视频URL');
    return match[1];
  }

  async getVideoInfo(url: string): Promise<VideoInfo> {
    try {
      const bvid = this.extractBvid(url);
      this.logger.info('正在获取视频信息...');

      const { data } = await axios.get(`${this.API_BASE}/web-interface/view`, {
        params: { bvid },
        headers: {
          'User-Agent': this.config.options.userAgent,
          ...(this.config.options.cookies ? { 'Cookie': this.config.options.cookies } : {})
        }
      });

      if (data.code !== 0) {
        throw new Error(`获取视频信息失败: ${data.message}`);
      }

      const { data: playData } = await axios.get(`${this.API_BASE}/player/playurl`, {
        params: {
          bvid,
          cid: data.data.cid,
          qn: 112,
          fnval: 16
        },
        headers: {
          'User-Agent': this.config.options.userAgent,
          'Referer': 'https://www.bilibili.com',
          ...(this.config.options.cookies ? { 'Cookie': this.config.options.cookies } : {})
        }
      });

      if (playData.code !== 0) {
        throw new Error(`获取视频流信息失败: ${playData.message}`);
      }

      const formats = playData.data.dash.video.map((video: any) => ({
        formatId: `${video.id}`,
        quality: `${video.height}p`,
        container: 'mp4',
        hasVideo: true,
        hasAudio: false,
        filesize: video.bandwidth ? Math.floor(video.bandwidth / 8) : undefined
      }));

      playData.data.dash.audio.forEach((audio: any) => {
        formats.push({
          formatId: `audio_${audio.id}`,
          quality: `${audio.codecs}`,
          container: 'mp4',
          hasVideo: false,
          hasAudio: true,
          filesize: audio.bandwidth ? Math.floor(audio.bandwidth / 8) : undefined
        });
      });

      return {
        id: bvid,
        title: data.data.title,
        description: data.data.desc,
        duration: Math.floor(data.data.duration),
        thumbnailUrl: data.data.pic,
        formats
      };

    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('获取视频信息失败:', error.message);
      } else {
        this.logger.error('获取视频信息失败:', error);
      }
      throw error;
    }
  }

  private async getVideoCid(bvid: string): Promise<number> {
    const { data } = await axios.get(`${this.API_BASE}/web-interface/view`, {
      params: { bvid },
      headers: {
        'User-Agent': this.config.options.userAgent,
        ...(this.config.options.cookies ? { 'Cookie': this.config.options.cookies } : {})
      }
    });

    if (data.code !== 0) {
      throw new Error(`获取视频信息失败: ${data.message}`);
    }

    return data.data.cid;
  }

  private async downloadStream(url: string, outputPath: string, options: any): Promise<void> {
    return new Promise((resolve, reject) => {
      let receivedBytes = 0;
      let totalBytes = 0;

      axios({
        method: 'GET',
        url: url,
        responseType: 'stream',
        headers: options.headers
      }).then(response => {
        totalBytes = parseInt(response.headers['content-length']);
        
        response.data.pipe(createWriteStream(outputPath))
          .on('finish', () => resolve())
          .on('error', reject);

        response.data.on('data', (chunk: Buffer) => {
          receivedBytes += chunk.length;
          if (options.onProgress) {
            const progress = Math.floor((receivedBytes / totalBytes) * 100);
            options.onProgress(progress);
          }
        });
      }).catch(reject);
    });
  }

  private async mergeAudioVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
    try {
      const ffmpeg = require('fluent-ffmpeg');
      return new Promise((resolve, reject) => {
        ffmpeg()
          .input(videoPath)
          .input(audioPath)
          .outputOptions(['-c:v copy', '-c:a aac'])
          .output(outputPath)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
    } catch (error) {
      throw new Error(`合并音视频失败: ${error}`);
    }
  }

  private async cleanupTempFiles(files: string[]): Promise<void> {
    const { unlink } = require('fs/promises');
    await Promise.all(files.map(file => unlink(file).catch(() => {})));
  }

  async getPopularVideos(count: number = 20): Promise<PopularVideo[]> {
    try {
      this.logger.info('获取B站热门视频...');
      const { data } = await axios.get(`${this.API_BASE}/web-interface/popular`, {
        params: { ps: count, pn: 1 },
        headers: {
          'User-Agent': this.config.options.userAgent,
          ...(this.config.options.cookies ? { 'Cookie': this.config.options.cookies } : {})
        }
      });

      if (data.code !== 0) {
        throw new Error(`获取热门视频失败: ${data.message}`);
      }

      return data.data.list.map((video: any) => ({
        id: video.bvid,
        title: video.title,
        description: video.desc,
        thumbnailUrl: video.pic,
        url: `https://www.bilibili.com/video/${video.bvid}`,
        viewCount: video.stat.view,
        uploadDate: new Date(video.pubdate * 1000).toISOString()
      }));
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('获取热门视频失败:', error.message);
      } else {
        this.logger.error('获取热门视频失败:', error);
      }
      throw error;
    }
  }

  async downloadVideo(url: string, options: DownloadOptions & AdvancedDownloadOptions): Promise<string> {
    try {
      const info = await this.getVideoInfo(url);
      const cid = await this.getVideoCid(info.id);
      
      const { data: playData } = await axios.get(`${this.API_BASE}/player/playurl`, {
        params: {
          bvid: info.id,
          cid: cid,
          qn: options.format || 112,
          fnval: 16
        },
        headers: {
          'User-Agent': this.config.options.userAgent,
          'Referer': 'https://www.bilibili.com',
          ...(this.config.options.cookies ? { 'Cookie': this.config.options.cookies } : {})
        }
      });

      if (playData.code !== 0) {
        throw new Error(`获取下载地址失败: ${playData.message}`);
      }

      const filename = options.filename || `${info.title}.mp4`;
      const outputPath = join(options.outputPath, filename);

      // 创建临时文件路径
      const tempVideoPath = `${outputPath}.video.tmp`;
      const tempAudioPath = `${outputPath}.audio.tmp`;

      // 下载视频流
      this.logger.info('下载视频流...');
      await this.downloadStream(playData.data.dash.video[0].baseUrl, tempVideoPath, {
        ...options,
        headers: {
          'Referer': 'https://www.bilibili.com',
          'User-Agent': this.config.options.userAgent,
          ...(this.config.options.cookies ? { 'Cookie': this.config.options.cookies } : {})
        }
      });

      // 下载音频流
      this.logger.info('下载音频流...');
      await this.downloadStream(playData.data.dash.audio[0].baseUrl, tempAudioPath, {
        ...options,
        headers: {
          'Referer': 'https://www.bilibili.com',
          'User-Agent': this.config.options.userAgent,
          ...(this.config.options.cookies ? { 'Cookie': this.config.options.cookies } : {})
        }
      });

      // 合并音视频
      this.logger.info('合并音视频...');
      await this.mergeAudioVideo(tempVideoPath, tempAudioPath, outputPath);

      // 删除临时文件
      await this.cleanupTempFiles([tempVideoPath, tempAudioPath]);

      return outputPath;
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('下载视频失败:', error.message);
      } else {
        this.logger.error('下载视频失败:', error);
      }
      throw error;
    }
  }
}
