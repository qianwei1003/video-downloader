import { IPlatform } from "./platform.interface";
import { DownloadOptions } from "../utils/types";

/**
 * 这里是一个 抖音 平台的示例实现
 * 实际情况下需要通过第三方库或自行实现下载逻辑
 */
export class DouyinPlatform implements IPlatform {
  public async downloadVideo(url: string, options: DownloadOptions): Promise<void> {
    console.log(`[DouyinPlatform] 下载视频: ${url}`);
    // TODO: 实现抖音的下载逻辑
    // 可通过解析网页、调用API等方式拿到视频源地址进行下载
  }

  public async getVideoInfo(url: string): Promise<unknown> {
    console.log(`[DouyinPlatform] 获取视频信息: ${url}`);
    // TODO: 调用抖音的API或解析网页获取视频信息
    return {
      status: "not implemented",
    };
  }
}
