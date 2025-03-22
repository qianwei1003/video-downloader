import { chromium } from 'playwright';
import type { SearchResult } from '../types/bilibili.js';

export class PlaywrightSearch {
  private async initBrowser() {
    return chromium.launch({
      headless: false
    });
  }

  async search(keyword: string): Promise<SearchResult[]> {
    const browser = await this.initBrowser();
    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      });
      const page = await context.newPage();

      // 设置更长的超时时间
      await page.setDefaultTimeout(30000);
      
      // 访问B站搜索页面并直接带上关键词
      await page.goto(`https://search.bilibili.com/all?keyword=${encodeURIComponent(keyword)}&order=click`, {
        waitUntil: 'networkidle'
      });
      
      // 等待搜索结果加载
      await page.waitForSelector('.search-content');

      // 等待具体的视频卡片元素出现
      await page.waitForSelector('.bili-video-card', { timeout: 10000 });
      
      // 等待一下确保所有卡片都加载完成
      await page.waitForTimeout(2000);

      // 提取视频信息
      const results = await page.evaluate(() => {
        const items = document.querySelectorAll('.bili-video-card');
        const results: Array<{
          id: string;
          title: string;
          author: string;
          duration: string;
          views: number;
          pubDate: string;
        }> = [];
        
        for (const item of Array.from(items)) {
          try {
            const titleEl = item.querySelector('a.bili-video-card__info--tit') as HTMLAnchorElement;
            const authorEl = item.querySelector('a.bili-video-card__info--author') as HTMLElement;
            const statsItems = item.querySelectorAll('.bili-video-card__stats--item');
            const viewsEl = statsItems[0] as HTMLElement;
            const durationEl = item.querySelector('.bili-video-card__stats__duration') as HTMLElement;
            
            const bvidMatch = (titleEl?.href || '').match(/BV[\w]+/);
            
            if (bvidMatch) {
              results.push({
                id: bvidMatch[0],
                title: titleEl?.textContent?.trim() || '',
                author: authorEl?.textContent?.trim() || '',
                duration: durationEl?.textContent?.trim() || '',
                views: parseInt(viewsEl?.textContent?.replace(/[^0-9]/g, '') || '0'),
                pubDate: new Date().toISOString()
              });
            }
          } catch (e) {
            console.error('Error processing item:', e);
          }
        }
        
        return results;
      });

      return results;
    } catch (error: unknown) {
      throw new Error(`搜索失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await browser.close();
    }
  }
}

export const playwrightSearch = new PlaywrightSearch();
