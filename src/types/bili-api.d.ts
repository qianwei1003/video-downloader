declare interface BiliVideoStream {
  id: number;
  base_url: string;
  bandwidth: number;
  mimeType: string;
  codecs: string;
  width: number;
  height: number;
  frameRate: string;
  codecid: number;
}

declare interface BiliDashData {
  video: BiliVideoStream[];
  audio: {
    id: number;
    base_url: string;
    bandwidth: number;
    mimeType: string;
    codecs: string;
  }[];
}

declare interface BiliPlayUrlData {
  from: string;
  result: string;
  message: string;
  quality: number;
  dash: BiliDashData;
}

declare interface BiliPlayUrlResponse {
  code: number;
  message: string;
  ttl: number;
  data: BiliPlayUrlData;
}

declare interface BiliVideoInfo {
  title: string;
  cid: number;
  duration: number;
  owner: {
    name: string;
  };
}
