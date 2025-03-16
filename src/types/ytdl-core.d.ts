declare module 'ytdl-core' {
  interface RequestOptions {
    headers: {
      cookie?: string;
      Authorization?: string;
      [key: string]: string | undefined;
    };
  }

  interface getInfoOptions {
    requestOptions?: RequestOptions;
  }

  interface ytdl {
    (url: string, options?: { format: any }): any;
    getInfo: (url: string, options?: getInfoOptions) => Promise<VideoInfo>;
    validateURL: (url: string) => boolean;
    chooseFormat: (formats: VideoFormat[], options: { quality: string }) => VideoFormat;
  }
  
  const ytdl: ytdl;
  export default ytdl;

  interface VideoFormat {
    itag: number;
    container: string;
    qualityLabel?: string;
    hasVideo?: boolean;
    hasAudio?: boolean;
    contentLength?: string;
  }

  interface VideoDetails {
    videoId: string;
    title: string;
    description: string;
    lengthSeconds: string;
    thumbnails: Array<{
      url: string;
      width: number;
      height: number;
    }>;
  }

  interface VideoInfo {
    formats: VideoFormat[];
    videoDetails: VideoDetails;
  }

  function getInfo(url: string, options?: getInfoOptions): Promise<VideoInfo>;
  function validateURL(url: string): boolean;
  function chooseFormat(formats: VideoFormat[], options: { quality: string }): VideoFormat;

  export { getInfo, validateURL, chooseFormat, VideoInfo, VideoFormat, VideoDetails, getInfoOptions, RequestOptions };
}
