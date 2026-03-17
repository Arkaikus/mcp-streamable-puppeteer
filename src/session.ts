import puppeteer, { type Browser, type Page } from "puppeteer-core";

interface Session {
  browser: Browser;
  tabs: Map<string, Page>; // tabId -> Page
}

const sessions = new Map<string, Session>();

/** Generate a unique identifier using the Web Crypto API (guaranteed by Bun). */
function generateId(): string {
  return crypto.randomUUID();
}

async function ensureBrowserConnection(host: string, port: number): Promise<Browser> {
  const res = await fetch(`http://${host}:${port}/json/version`);
  if (!res.ok) {
    throw new Error(
      `Failed to reach browser debugger at ${host}:${port}: ${res.status} ${res.statusText}`
    );
  }
  const data = (await res.json()) as { webSocketDebuggerUrl: string };
  return puppeteer.connect({ browserWSEndpoint: data.webSocketDebuggerUrl });
}

/**
 * Connect a session to the browser. If the session already exists and the
 * browser is still connected it is reused. Returns the sessionId and a list
 * of all currently open tabs with their assigned tabIds.
 */
export async function connectSession(
  sessionId: string,
  host: string = Bun.env.BROWSER_DEBUG_HOST ?? "localhost",
  port: number = Number(Bun.env.BROWSER_DEBUG_PORT ?? 9222)
): Promise<{ sessionId: string; tabs: { tabId: string; url: string; title: string }[] }> {
  const existing = sessions.get(sessionId);
  if (existing?.browser.connected) {
    const tabs = await buildTabList(existing);
    return { sessionId, tabs };
  }

  const browser = await ensureBrowserConnection(host, port);
  const session: Session = { browser, tabs: new Map() };

  // Assign fresh IDs to every page already open in the browser
  const pages = await browser.pages();
  for (const page of pages) {
    const tabId = generateId();
    session.tabs.set(tabId, page);
    page.on("close", () => session.tabs.delete(tabId));
  }

  sessions.set(sessionId, session);
  browser.on("disconnected", () => sessions.delete(sessionId));

  const tabs = await buildTabList(session);
  return { sessionId, tabs };
}

async function buildTabList(
  session: Session
): Promise<{ tabId: string; url: string; title: string }[]> {
  const result: { tabId: string; url: string; title: string }[] = [];
  for (const [tabId, page] of session.tabs) {
    // isClosed() guards against race conditions between the close event and map cleanup
    if (!page.isClosed()) {
      result.push({ tabId, url: page.url(), title: await page.title() });
    }
  }
  return result;
}

/** Retrieve a page by sessionId + tabId. Throws if either does not exist. */
export async function getPage(sessionId: string, tabId: string): Promise<Page> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session '${sessionId}' not found. Call puppeteer_connect_active_tab first.`);
  }
  const page = session.tabs.get(tabId);
  if (!page || page.isClosed()) {
    throw new Error(`Tab '${tabId}' not found in session '${sessionId}'.`);
  }
  return page;
}

/**
 * Open a new tab in the given session, optionally navigating to a URL.
 * Returns the new tabId and the resulting URL.
 */
export async function openTab(
  sessionId: string,
  url?: string
): Promise<{ tabId: string; url: string }> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session '${sessionId}' not found. Call puppeteer_connect_active_tab first.`);
  }
  const page = await session.browser.newPage();
  const tabId = generateId();
  session.tabs.set(tabId, page);
  page.on("close", () => session.tabs.delete(tabId));

  if (url) {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
  }

  return { tabId, url: page.url() };
}

/** Close a specific tab. */
export async function closeTab(sessionId: string, tabId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new Error(`Session '${sessionId}' not found.`);
  }
  const page = session.tabs.get(tabId);
  if (!page) {
    throw new Error(`Tab '${tabId}' not found in session '${sessionId}'.`);
  }
  await page.close();
  session.tabs.delete(tabId);
}
