import type { SearchResult } from "../types/bilibili.js";
import { searchVideos } from "./bilibili.js";

export class PlaywrightSearch {
  async search(
    keyword: string,
    order: "pubdate" | "click" | "scores" = "pubdate"
  ): Promise<SearchResult[]> {
    console.log("开始搜索, 关键词:", keyword, "排序方式:", order);
    return searchVideos({
      keyword,
      order,
      page: 1,
      pageSize: 20
    });
  }
}

export const playwrightSearch = new PlaywrightSearch();
