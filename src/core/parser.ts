/// src/core/parser.ts

/**
 * Parser
 * 负责对输入链接进行解析和验证，并可提取出对应平台信息等
 */
export class Parser {
  /**
   * 验证URL是否符合预期
   */
  public validate(url: string): boolean {
    // 简单示例：判断是否以http(s)开头
    return /^https?:\/\//.test(url);
  }

  /**
   * 解析URL，返回可能包含的平台类型等信息
   */
  public parse(url: string): { platform: string; videoId?: string } {
    // TODO: 在此实现更丰富的解析逻辑，比如匹配不同平台的域名、提取视频ID等
    if (url.includes("youtube.com") || url.includes("youtu.be")) {
      return { platform: "youtube" };
    } else if (url.includes("bilibili.com")) {
      return { platform: "bilibili" };
    } else if (url.includes("douyin.com")) {
      return { platform: "douyin" };
    }
    return { platform: "unknown" };
  }
}
