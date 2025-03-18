import { IPlatform } from "./platform.interface";
import { DownloadOptions } from "../utils/types";
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';

/**
 * Bilibili 平台实现
 */
export class BilibiliPlatform implements IPlatform {
  private isValidOutputPath(outputPath: string): boolean {
    const basePath = process.env.DOWNLOAD_BASE_PATH || process.cwd();
    const maxDepth = 2;

    // 规范化路径
    const normalizedPath = path.normalize(outputPath);
    const normalizedBasePath = path.normalize(basePath);

    // 检查路径是否在允许的目录下
    if (!normalizedPath.startsWith(normalizedBasePath)) {
      return false;
    }

    // 检查目录深度
    const relativeDepth = path.relative(normalizedBasePath, normalizedPath)
      .split(path.sep)
      .length - 1;
    
    return relativeDepth <= maxDepth;
  }

  private parseFileSize(sizeStr: string): number {
    const units = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };

    const match = sizeStr.match(/^(\d+)\s*(B|KB|MB|GB)$/i);
    if (!match) {
      throw new Error(`无效的文件大小格式: ${sizeStr}`);
    }

    const size = parseInt(match[1], 10);
    const unit = match[2].toUpperCase() as keyof typeof units;
    
    return size * units[unit];
  }

  private async downloadFile(url: string, outputPath: string): Promise<void> {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      headers: {
        'Referer': 'https://www.bilibili.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // 检查文件大小限制
    const maxSize = this.parseFileSize(process.env.MAX_FILE_SIZE || '2GB');
    const contentLength = Number(response.headers['content-length'] || 0);
    
    if (contentLength > maxSize) {
      throw new Error(`文件大小超过限制：${contentLength} > ${maxSize}`);
    }

    // 确保目标目录存在
    const targetDir = path.dirname(outputPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }

  private async mergeAudioVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        .input(audioPath)
        .outputOptions(['-c:v copy', '-c:a aac'])
        .saveToFile(outputPath)
        .on('end', () => {
          resolve();
        })
        .on('error', (err: Error) => {
          reject(err);
        });
    });
  }

  public async downloadVideo(url: string, options: DownloadOptions): Promise<void> {
    try {
      console.log(`[BilibiliPlatform] 开始下载: ${url}`);
      
      // 从URL中提取BV号
      const bvid = url.match(/BV\w+/)?.[0];
      if (!bvid) {
        throw new Error('无效的B站视频URL');
      }

      // 获取视频信息
      const infoResponse = await axios.get<{code: number; message: string; data: BiliVideoInfo}>(`https://api.bilibili.com/x/web-interface/view`, {
        params: { bvid }
      });

      if (infoResponse.data.code !== 0) {
        throw new Error(`获取视频信息失败: ${infoResponse.data.message}`);
      }

      const videoInfo = infoResponse.data.data;
      // 使用配置的下载路径
      const filename = videoInfo.title.replace(/[<>:"/\\|?*]/g, '_');
      const ext = options.downloadAudio ? '.mp3' : '.mp4';
      const basePath = process.env.DOWNLOAD_BASE_PATH || process.cwd();
      const outputPath = options.outputPath || path.join(basePath, `${filename}${ext}`);

      // 验证输出路径
      if (!this.isValidOutputPath(outputPath)) {
        throw new Error('不允许的下载路径');
      }

      // 获取视频流URL
      if (!videoInfo.cid) {
        throw new Error('无法获取视频cid');
      }

      console.log(`[BilibiliPlatform] 请求播放地址: bvid=${bvid}, cid=${videoInfo.cid}`);
      const playUrlResponse = await axios.get<BiliPlayUrlResponse>(`https://api.bilibili.com/x/player/playurl`, {
        params: {
          bvid,
          cid: videoInfo.cid,
          qn: options.quality === 'high' ? 116 : options.quality === 'low' ? 16 : 64,
          fnval: 16, // 启用DASH
          fnver: 0,
          fourk: 1 // 允许4K清晰度
        }
      });

      if (playUrlResponse.data.code !== 0) {
        throw new Error(`获取视频地址失败: ${playUrlResponse.data.message}`);
      }

      const videoData = playUrlResponse.data.data;
      if (!videoData || !videoData.dash || !videoData.dash.video || !videoData.dash.video.length) {
        throw new Error('获取视频地址失败: DASH视频数据格式无效');
      }

      // 根据quality选择视频流
      const qualityMap: Record<string, number> = {
        'high': 64,   // 720P
        'medium': 32, // 480P
        'low': 16     // 360P
      };
      const targetQuality = qualityMap[options.quality || 'medium'];
      const videoStream = videoData.dash.video.find(v => v.id === targetQuality) || videoData.dash.video[0];
      const audioStream = videoData.dash.audio?.[0];

      if (!videoStream) {
        throw new Error('找不到合适的视频流');
      }

      const videoUrl = videoStream.base_url;
      const tempVideoPath = path.join(path.dirname(outputPath), `${filename}_video.mp4`);
      const tempAudioPath = path.join(path.dirname(outputPath), `${filename}_audio.mp4`);

      // 下载视频流
      console.log(`[BilibiliPlatform] 正在下载视频流...`);
      await this.downloadFile(videoUrl, tempVideoPath);

      // 下载音频流
      if (audioStream) {
        console.log(`[BilibiliPlatform] 正在下载音频流...`);
        await this.downloadFile(audioStream.base_url, tempAudioPath);

        // 使用ffmpeg合并音视频
        console.log(`[BilibiliPlatform] 合并音视频...`);
        await this.mergeAudioVideo(tempVideoPath, tempAudioPath, outputPath);

        // 删除临时文件
        fs.unlinkSync(tempVideoPath);
        fs.unlinkSync(tempAudioPath);
      } else {
        // 如果没有音频流，直接使用视频文件
        fs.renameSync(tempVideoPath, outputPath);
      }

      console.log(`[BilibiliPlatform] 下载完成: ${outputPath}`);

    } catch (error) {
      console.error(`[BilibiliPlatform] 下载失败:`, error);
      throw error;
    }
  }

  public async getVideoInfo(url: string): Promise<unknown> {
    console.log(`[BilibiliPlatform] 获取视频信息: ${url}`);
    const bvid = url.match(/BV\w+/)?.[0];
    if (!bvid) {
      throw new Error('无效的B站视频URL');
    }

    const response = await axios.get<{code: number; message: string; data: BiliVideoInfo}>(`https://api.bilibili.com/x/web-interface/view`, {
      params: { bvid }
    });

    if (response.data.code !== 0) {
      throw new Error(`获取视频信息失败: ${response.data.message}`);
    }

    const info = response.data.data;
    return {
      title: info.title,
      lengthSeconds: info.duration,
      author: info.owner.name,
    };
  }
}
