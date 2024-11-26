// nodes/TextDuplicator/services/PageManager.ts

import { Browser, chromium, BrowserContext, Page } from 'playwright';
import { SearchManager } from './SearchManager';

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
  console.log('Starting getSearchContent...');
  console.log(query);

  // Validate the input query
  if (!query?.trim()) {
    throw new Error('Search query cannot be empty');
  }

  // Launch a headless browser instance
  const browser = await chromium.launch({
    headless: true,
    timeout: this.PAGE_TIMEOUT
  });

  try {
    // Retrieve search links based on the query
    const links = await SearchManager.getSearchLinks(browser, query);
    console.log(`Found ${links.length} links`);

    // Return an empty string if no links are found
    if (!links.length) {
      return '';
    }

    // Calculate the number of iterations (limited by MAX_ITERATIONS)
    const iterations = Math.min(this.MAX_ITERATIONS, Math.ceil(links.length / this.BATCH_SIZE));

    // Initialize metrics for tracking successes and failures
    const metrics: PageMetrics = { successCount: 0, failureCount: 0, totalLinks: links.length };

    // Create batch promises for processing links in chunks
    const batchPromises = Array.from({ length: iterations }, async (_, i) => {
      // Slice the batch of links for this iteration
      const batch = links.slice(i * this.BATCH_SIZE, (i + 1) * this.BATCH_SIZE);

      // Process each link in the batch with a delay for rate-limiting
      const contents = await Promise.allSettled(
        batch.map(async (link, index) => {
          await new Promise(resolve => setTimeout(resolve, index * this.RATE_LIMIT_DELAY)); // Apply rate limit
          const content = await this.getPageContent(browser, link); // Fetch page content

          // Update success and failure metrics
          if (content) metrics.successCount++;
          else metrics.failureCount++;

          return content || ''; // Return content or an empty string if null
        })
      );

      // Filter fulfilled results and join their content
      return contents
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<string>).value)
        .join(' ');
    });

    // Wait for all batch promises to complete and aggregate their results
    const results = await Promise.all(batchPromises);
    let combinedContent = results.join(' ');

    // Enforce a maximum content length limit
    if (combinedContent.length > this.MAX_CONTENT_LENGTH) {
      combinedContent = combinedContent.slice(0, this.MAX_CONTENT_LENGTH);
    }

    console.log(combinedContent); // Log the combined content
    return combinedContent.trim(); // Return the trimmed content
  } catch (error) {
    // Log and throw an error with additional context
    console.error('Error during getSearchContent:', error);
    throw new Error(`Failed to retrieve search content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Ensure the browser is closed regardless of success or failure
    await browser.close();
  }
}


private static async getPageContent(browser: Browser, url: string): Promise<string | null> {
	console.log(url);

	// Validate the URL: must start with 'http' and not end with '.pdf'
	if (!url?.startsWith('http') || url.toLowerCase().endsWith('.pdf')) {
			return null;
	}

	// Set up an isolated browser context and a new page
	const context = await this.setupBrowserContext(browser);
	const page = await context.newPage();

	try {
			// Set a referer header to mimic access from Google
			await page.setExtraHTTPHeaders({
					'Referer': 'https://www.google.com/'
			});

			// Introduce a random delay (100-300ms) to mimic human behavior
			await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

			// Navigate to the URL and wait for the network to idle
			await page.goto(url, {
					waitUntil: 'networkidle', // Wait until there are no more than 2 network connections
					timeout: this.PAGE_TIMEOUT // Use the specified timeout for loading
			});

			// Wait for the DOM content to fully load
			await page.waitForLoadState('domcontentloaded');
			// Add an extra 1-second delay for additional rendering
			await page.waitForTimeout(1000);

			// Extract the page content and clean up whitespace
			const content = await this.extractPageContent(page);

			console.log(content?.replace(/\s+/g, ' ').trim());

			return content?.replace(/\s+/g, ' ').trim() || null; // Return cleaned content or null if empty

	} catch (error) {
			// Return null if any error occurs during processing
			return null;

	} finally {
			// Ensure the browser context is closed to release resources
			await context.close();
	}
}

private static async extractPageContent(page: Page): Promise<string> {
  try {
    return await page.evaluate(() => {
      // Define selectors to remove unnecessary elements
      const selectorsToRemove = [
        'header', 'footer', 'nav', '.advertisement', '.ads',
        '.cookie-notice', '.popup', '.modal', '#comments',
        '.sidebar', '.social-share', '.related-posts'
      ];

      // Define selectors for likely content areas
      const contentSelectors = [
        'main article', '[role="main"] article', '.content-area',
        '#content', '.post-content'
      ];

      // Hide distracting elements instead of removing them (improved performance)
			selectorsToRemove.forEach(selector => {
				document.querySelectorAll(selector).forEach(el => {
					(el as HTMLElement).style.display = 'none'; // Only hide, don't remove
				});
			});

      // Try extracting content from prioritized selectors
      for (const selector of contentSelectors) {
        const element: HTMLElement | null = document.querySelector(selector);
        if (element) return element.innerText;
      }

      // Fallback: Use broader selectors for main content
      const mainContent: HTMLElement | null = document.querySelector('main, article, [role="main"]');
      if (mainContent) return mainContent.innerText;

      // Final fallback: Extract all text from the body
      return document.body.innerText;
    });
  } catch (error) {
    // Log errors for debugging
    console.error('Error extracting page content:', error);

    // Fallback: Extract text content of the body
    return await page.$eval('body', el => el.innerText);
  }
}

}
