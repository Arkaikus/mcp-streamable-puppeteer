import puppeteer, { type Browser, type Page } from "puppeteer-core";

let browser: Browser | null = null;
let currentPage: Page | null = null;

export async function getDebuggerWebSocketUrl(
  host: string = Bun.env.BROWSER_DEBUG_HOST ?? "localhost",
  port: number = Number(Bun.env.BROWSER_DEBUG_PORT ?? 9222)
): Promise<string> {
  const res = await fetch(`http://${host}:${port}/json/version`);
  if (!res.ok) {
    throw new Error(`Failed to fetch debugger info: ${res.status} ${res.statusText}`);
  }
  const data = await res.json() as { webSocketDebuggerUrl: string };
  return data.webSocketDebuggerUrl;
}

export async function connectToExistingBrowser(wsEndpoint: string): Promise<Browser> {
  if (browser?.connected) return browser;
  browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
  browser.on("disconnected", () => {
    browser = null;
    currentPage = null;
  });
  return browser;
}

export async function ensureBrowser(): Promise<Page> {
  if (currentPage && !currentPage.isClosed()) return currentPage;

  if (!browser?.connected) {
    const wsEndpoint = await getDebuggerWebSocketUrl();
    browser = await connectToExistingBrowser(wsEndpoint);
  }

  const pages = await browser.pages();
  currentPage = pages.length > 0 ? pages[0] : await browser.newPage();
  return currentPage;
}

export function setCurrentPage(page: Page): void {
  currentPage = page;
}
