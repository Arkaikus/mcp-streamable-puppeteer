/**
 * Integration tests for Puppeteer ↔ chromedp/headless-shell (CDP) interaction.
 * Uses the session module directly (not MCP tools) to validate operations.
 *
 * Requires headless-shell. Run first:
 *   docker compose up headless-shell -d
 *
 * Then:  bun test tests/
 *
 * Uses localhost:9222 (MCP shares network with headless-shell in docker-compose).
 * Tests are skipped when the browser is not reachable.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { closeTab, connectSession, getPage, openTab } from "../src/session";

const BROWSER_URL = "http://localhost:9222/json/version";

async function isBrowserReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(BROWSER_URL, {
      signal: controller.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

const BROWSER_REACHABLE = await isBrowserReachable();
if (!BROWSER_REACHABLE) {
  console.warn(
    `Skipping Puppeteer CDP integration tests: browser not reachable at localhost:9222. Run \`docker compose up headless-shell -d\` and ensure the debug port is accessible.`,
  );
}

const TEST_PAGE_HTML = `
<!DOCTYPE html>
<html>
<head><title>CDP Test</title></head>
<body>
  <h1 id="heading">Hello CDP</h1>
  <button id="click-me">Click me</button>
  <input id="input" type="text" value="initial" />
  <span id="output"></span>
  <script>
    document.getElementById('click-me').addEventListener('click', () => {
      document.getElementById('output').textContent = 'clicked';
    });
  </script>
</body>
</html>
`;

const TEST_PAGE_DATA_URL = `data:text/html;charset=utf-8,${encodeURIComponent(TEST_PAGE_HTML)}`;

let sessionId: string;
let tabId: string;

describe.skipIf(!BROWSER_REACHABLE)(
  "Puppeteer ↔ chromedp/headless-shell (CDP)",
  () => {
    beforeAll(async () => {
      const result = await connectSession(crypto.randomUUID());
      sessionId = result.sessionId;

      const { tabId: newTabId } = await openTab(
        sessionId,
        TEST_PAGE_DATA_URL,
        10000,
      );
      tabId = newTabId;
    });

    afterAll(async () => {
      if (sessionId && tabId) {
        try {
          await closeTab(sessionId, tabId);
        } catch {
          // Tab may already be closed
        }
      }
    });

    test("connects to headless-shell and opens a tab", () => {
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBeGreaterThan(0);
      expect(tabId).toBeDefined();
      expect(typeof tabId).toBe("string");
      expect(tabId.length).toBeGreaterThan(0);
    });

    test("retrieves page content", async () => {
      const page = await getPage(sessionId, tabId);
      const html = await page.content();
      expect(html).toContain("Hello CDP");
      expect(html).toContain('id="heading"');
      expect(html).toContain("Click me");
    });

    test("evaluates JavaScript in the page", async () => {
      const page = await getPage(sessionId, tabId);
      const title = await page.evaluate(() => document.title);
      expect(title).toBe("CDP Test");

      const headingText = await page.evaluate(
        () => document.getElementById("heading")?.textContent,
      );
      expect(headingText).toBe("Hello CDP");
    });

    test("clicks an element", async () => {
      const page = await getPage(sessionId, tabId);
      await page.click("#click-me");
      const output = await page.evaluate(
        () => document.getElementById("output")?.textContent,
      );
      expect(output).toBe("clicked");
    });

    test("fills an input", async () => {
      const page = await getPage(sessionId, tabId);
      await page.click("#input", { clickCount: 3 });
      await page.keyboard.type("filled");
      const value = await page.evaluate(
        () => (document.getElementById("input") as HTMLInputElement)?.value,
      );
      expect(value).toBe("filled");
    });

    test("gets page URL", async () => {
      const page = await getPage(sessionId, tabId);
      const url = page.url();
      expect(url).toContain("data:text/html");
      expect(decodeURIComponent(url)).toContain("Hello CDP");
    });
  },
);
