import { DownloadOptions } from "../utils/types";

/**
 * 平台接口定义
 */
export interface IPlatform {
  /**
   * 下载视频
   * @param url 视频链接
   * @param options 下载选项
   */
  downloadVideo(url: string, options: DownloadOptions): Promise<void>;

  /**
   * 获取视频信息
   * @param url 视频链接
   */
  getVideoInfo(url: string): Promise<unknown>; // 这里返回类型可根据需要定义
}
