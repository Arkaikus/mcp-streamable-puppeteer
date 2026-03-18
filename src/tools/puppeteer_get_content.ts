import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPage } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_get_content",
    {
      description:
        "Retrieve the HTML content of a specific browser tab for scraping or analysis. " +
        "Optionally limit the result to the inner HTML of a CSS-selected element.",
      inputSchema: z.object({
        sessionId: z
          .string()
          .describe(
            "Session identifier returned by puppeteer_navigate or puppeteer_active_tabs",
          ),
        tabId: z
          .string()
          .describe(
            "Tab identifier returned by puppeteer_navigate or puppeteer_active_tabs",
          ),
        selector: z
          .string()
          .optional()
          .describe(
            "CSS selector whose outer HTML to return (default: full page HTML)",
          ),
      }),
    },
    async ({ sessionId, tabId, selector }) => {
      try {
        const page = await getPage(sessionId, tabId);

        let html: string;

        if (selector) {
          const element = await page.waitForSelector(selector);
          if (!element) throw new Error(`Element not found: ${selector}`);
          html = await page.evaluate((el) => el.outerHTML, element);
        } else {
          html = await page.content();
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "success",
                html,
                selector: selector ?? null,
                nextStep:
                  "Use puppeteer_click, puppeteer_fill, puppeteer_select, or puppeteer_screenshot for further interaction.",
              }),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "error",
                error: message,
                action: "get_content",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
};
