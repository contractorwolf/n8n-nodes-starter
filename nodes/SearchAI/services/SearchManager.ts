import { Browser } from 'playwright';

// Base URL for Google search queries
const SEARCH_URL = "https://www.google.com/search?q=";

// Chrome browser user agent string for realistic request simulation
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36";

// Maximum time (in ms) to wait for page operations
const SEARCH_TIMEOUT = 60000;

export class SearchManager {
  /**
   * Fetches and filters Google search result links for a given query
   * @param {Browser} browser - Playwright browser instance
   * @param {string} query - Search query string
   * @returns {Promise<string[]>} Array of unique, filtered URLs
   */
  static async getSearchLinks(browser: Browser, query: string) {
    console.log(`Starting search for query: "${query}"`);
    
    // Create new browser context with custom user agent
    const context = await browser.newContext({
      userAgent: USER_AGENT
    });
    // console.log('Created browser context with custom user agent');
    
    // Initialize new page in browser context
    const page = await context.newPage();
    // console.log('Initialized new browser page');

    // Set global timeout for page operations
    await page.setDefaultTimeout(SEARCH_TIMEOUT);
    // console.log(`Set page timeout to ${SEARCH_TIMEOUT}ms`);
    
    // Navigate to Google search with encoded query
    console.log('Navigating to Google search...');
    await page.goto(SEARCH_URL + encodeURIComponent(query));
    // console.log('Successfully loaded search results page');
    
    // Extract and filter search result links
    console.log('Extracting and filtering search results...');
    const links = await page.$$eval('a[jsname]', (elements: any[]) => 
      elements.map(el => el.href)
        .filter(href => href && 
                href.startsWith('https') && 
                !href.includes('google') && 
                !href.includes('youtube'))
        .map(href => href.split('#')[0].split('?')[0])
    );
    // console.log(`Found ${links.length} raw links`);
    
    // Clean up browser context
    await context.close();
    // console.log('Closed browser context');
    
    // Return deduplicated array of links
    const uniqueLinks = [...new Set(links)];
    //console.log(`Returning ${uniqueLinks.length} unique filtered links`);
    return uniqueLinks;
  }
} 