export interface DownloadTask {
  id: string;
  url: string;
  options: DownloadOptions;
  status: TaskStatus;
}

export interface BatchDownloadOptions extends DownloadOptions {
  urls: string[];
  concurrency?: number;
  outputDir?: string;
}

export interface VideoInfo {
  title: string;
  author: string;
  duration: string;
  quality: string[];
}

export interface TaskStatus {
  id: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number;
  message?: string;
}

export interface DownloadOptions {
  quality?: string;
  output?: string;
}

export interface SearchResult {
  id: string;       // 视频BV号
  title: string;    // 视频标题
  author: string;   // UP主
  duration: string; // 时长
  views: number;    // 播放量
  pubDate: string;  // 发布日期
}

export interface SearchOptions {
  keyword: string;  // 搜索关键词
  page?: number;    // 页码,默认1
  pageSize?: number;// 每页数量,默认20
  order?: 'pubdate' | 'click' | 'scores'; // 排序方式:发布时间/播放量/综合评分
}

export interface CallToolRequest {
  params: {
    name: string;
    arguments: {
      url?: string;
      urls?: string[];
      quality?: string;
      output?: string;
      outputDir?: string;
      concurrency?: number;
      keyword?: string;
      page?: number;
      pageSize?: number;
      order?: 'pubdate' | 'click' | 'scores';
    };
  };
}
