import { IPlatform } from "./platform.interface";
import { DownloadOptions } from "../utils/types";
import ytdl from "ytdl-core";

export class YouTubePlatform implements IPlatform {
  public async downloadVideo(url: string, options: DownloadOptions): Promise<void> {
    console.log(`[YouTubePlatform] 下载视频: ${url}`);
    // 仅做演示，实际可能需要通过stream写到文件中
    const info = await ytdl.getInfo(url);
    console.log("视频标题:", info.videoDetails.title);
    // TODO: 将该流写到文件中或进行后续处理
  }

  public async getVideoInfo(url: string): Promise<unknown> {
    console.log(`[YouTubePlatform] 获取视频信息: ${url}`);
    const info = await ytdl.getInfo(url);
    return {
      title: info.videoDetails.title,
      lengthSeconds: info.videoDetails.lengthSeconds,
      author: info.videoDetails.author.name,
    };
  }
}
