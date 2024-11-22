// nodes/TextDuplicator/services/PageManager.ts

import { Browser, chromium, BrowserContext, Page } from 'playwright';

interface PageMetrics {
 successCount: number;
 failureCount: number;
 totalLinks: number;
}

export class PageManager {
 private static readonly BATCH_SIZE = 8;
 private static readonly MAX_ITERATIONS = 5;
 private static readonly PAGE_TIMEOUT = 45000;
 private static readonly MAX_CONTENT_LENGTH = 1000000;
 private static readonly RATE_LIMIT_DELAY = 1000;

 private static async setupBrowserContext(browser: Browser): Promise<BrowserContext> {
   return await browser.newContext({
     extraHTTPHeaders: {
       'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
       'Accept-Language': 'en-US,en;q=0.5',
       'Accept-Encoding': 'gzip, deflate, br',
       'Connection': 'keep-alive',
       'Upgrade-Insecure-Requests': '1',
       'Sec-Fetch-Dest': 'document',
       'Sec-Fetch-Mode': 'navigate',
       'Sec-Fetch-Site': 'none',
       'Sec-Fetch-User': '?1',
       'DNT': '1',
       'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
     },
     viewport: { width: 1920, height: 1080 },
     userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
     deviceScaleFactor: 1,
     isMobile: false,
     hasTouch: false,
     javaScriptEnabled: true
   });
 }

 public static async getSearchContent(query: string): Promise<string> {
   if (!query?.trim()) {
     throw new Error('Search query cannot be empty');
   }

   const browser = await chromium.launch({ 
     headless: true,
     timeout: this.PAGE_TIMEOUT 
   });

   try {
     const links = await this.getSearchLinks(browser, query);
     const totalLinks = links.length;
     
     if (!links.length) {
       return '';
     }

     let combinedContent = '';
     const iterations = Math.min(this.MAX_ITERATIONS, Math.ceil(links.length / this.BATCH_SIZE));
     
     const metrics: PageMetrics = {
       successCount: 0,
       failureCount: 0,
       totalLinks
     };
     
     const batchPromises = Array.from({ length: iterations }, async (_, i) => {
       const batch = links.slice(i * this.BATCH_SIZE, (i + 1) * this.BATCH_SIZE);
       const contents = await Promise.race([
         Promise.all(
           batch.map(async (link, index) => {
             await new Promise(resolve => setTimeout(resolve, index * this.RATE_LIMIT_DELAY));
             const content = await this.getPageContent(browser, link);
             
             if (content) {
               metrics.successCount++;
             } else {
               metrics.failureCount++;
             }

             return content;
           })
         ),
         new Promise<string[]>((_, reject) => 
           setTimeout(() => reject(new Error('Batch timeout')), 60000)
         )
       ]).catch(error => {
         console.warn(`Batch ${i} timed out or failed:`, error);
         return [];
       });
       
       return contents.filter(Boolean).join(' ');
     });

     const results = await Promise.all(batchPromises);
     combinedContent = results.join(' ');

     if (combinedContent.length > this.MAX_CONTENT_LENGTH) {
       combinedContent = combinedContent.slice(0, this.MAX_CONTENT_LENGTH);
     }

     return combinedContent.trim();
   } catch (error) {
     if (error instanceof Error) {
       throw new Error(`Failed to retrieve search content: ${error.message}`);
     }
     throw new Error('Unknown error during search content retrieval');
   } finally {
     await browser.close();
   }
 }

 private static async getPageContent(browser: Browser, url: string): Promise<string | null> {
   if (!url?.startsWith('http') || url.toLowerCase().endsWith('.pdf')) {
     return null;
   }

   const context = await this.setupBrowserContext(browser);
   const page = await context.newPage();

   try {
     await page.setExtraHTTPHeaders({
       'Referer': 'https://www.google.com/'
     });

     await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

     await page.goto(url, { 
       waitUntil: 'networkidle',
       timeout: this.PAGE_TIMEOUT 
     });

     await page.waitForLoadState('domcontentloaded');
     await page.waitForTimeout(1000);

     const content = await this.extractPageContent(page);
     return content?.replace(/\s+/g, ' ').trim() || null;

   } catch (error) {
     return null;
   } finally {
     await context.close();
   }
 }

 private static async extractPageContent(page: Page): Promise<string> {
   try {
     return await page.evaluate(() => {
       const selectorsToRemove = [
         'header', 'footer', 'nav', '.advertisement', '.ads',
         '.cookie-notice', '.popup', '.modal', '#comments',
         '.sidebar', '.social-share', '.related-posts'
       ];
       
       const contentSelectors = [
         'main article', '[role="main"] article', '.content-area',
         '#content', '.post-content'
       ];
       
       selectorsToRemove.forEach(selector => {
         document.querySelectorAll(selector).forEach(el => el.remove());
       });
       
       for (const selector of contentSelectors) {
         const element = document.querySelector(selector);
         if (element) return element.innerText;
       }
       
       const mainContent = document.querySelector('main, article, [role="main"]');
       if (mainContent) return mainContent.innerText;
       
       return document.body.innerText;
     });
   } catch (error) {
     return await page.$eval('body', el => el.innerText);
   }
 }
 
 private static async getSearchLinks(browser: Browser, query: string): Promise<string[]> {
   // This method would need to be implemented based on your SearchManager class
   // Returning empty array for now as placeholder
   return [];
 }
}