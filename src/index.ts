// src/index.ts
import { Downloader } from "./core/downloader";
import { BilibiliPlatform } from "./platforms/bilibili";
import { DownloadOptions } from "./utils/types";
import { IPlatform } from "./platforms/platform.interface";

const downloader = new Downloader();

// 注册支持的平台
const bilibili = new BilibiliPlatform();
// 注册所有可能的B站域名变体
["bilibili.com", "www.bilibili.com", "m.bilibili.com"].forEach(domain => {
  downloader.registerPlatform(domain, bilibili);
});

// 导出 MCP 工具接口
export const tools = {
  download_video: async ({url, options}: {url: string, options?: DownloadOptions}): Promise<{success: boolean, error?: string}> => {
    try {
      await downloader.download(url, options || {});
      return {success: true};
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },
  
  search_videos: async (platform: string, keyword: string, filters?: any) => {
    throw new Error("搜索功能尚未实现");
  }
};

console.log("Video Downloader Service Initialized");
