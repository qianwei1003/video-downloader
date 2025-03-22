import { playwrightSearch } from "./services/playwright-search.js";

async function testSearch() {
  try {
    console.log("测试搜索功能开始...");

    console.log("\n=== 测试按发布时间搜索 ===");
    const resultsByDate = await playwrightSearch.search("原神", "pubdate");
    console.log("搜索结果数量:", resultsByDate.length);
    console.log("\n前5个结果:");
    resultsByDate.slice(0, 5).forEach((result, index) => {
      console.log(`\n[${index + 1}] ${result.title}`);
      console.log(`BV号: ${result.id}`);
      console.log(`作者: ${result.author}`);
      console.log(`时长: ${result.duration}`);
      console.log(`播放量: ${result.views}`);
      console.log(`发布时间: ${new Date(result.pubDate).toLocaleString()}`);
      console.log(`视频链接: https://www.bilibili.com/video/${result.id}`);
    });

    console.log("\n=== 测试按播放量搜索 ===");
    const resultsByViews = await playwrightSearch.search("原神", "click");
    console.log("\n搜索结果数量:", resultsByViews.length);
    console.log("\n前5个结果:");
    resultsByViews.slice(0, 5).forEach((result, index) => {
      console.log(`\n[${index + 1}] ${result.title}`);
      console.log(`BV号: ${result.id}`);
      console.log(`作者: ${result.author}`);
      console.log(`时长: ${result.duration}`);
      console.log(`播放量: ${result.views.toLocaleString()}`);
      console.log(`发布时间: ${new Date(result.pubDate).toLocaleString()}`);
      console.log(`视频链接: https://www.bilibili.com/video/${result.id}`);
    });
    
    // 测试下载第一个播放量最高的视频
    if (resultsByViews.length > 0) {
      console.log("\n=== 测试下载播放量最高的视频 ===");
      const videoUrl = `https://www.bilibili.com/video/${resultsByViews[0].id}`;
      console.log("开始下载视频:", videoUrl);
      console.log("标题:", resultsByViews[0].title);
      
      const { downloadVideo } = await import('./services/bilibili.js');
      const outputPath = await downloadVideo(videoUrl, { quality: '720p' });
      console.log("下载完成，保存到:", outputPath);
    }
  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

testSearch();
