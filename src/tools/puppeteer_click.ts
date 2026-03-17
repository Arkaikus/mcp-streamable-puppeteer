import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPage } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_click",
    {
      description: "Click on an element in a specific browser tab",
      inputSchema: z.object({
        sessionId: z
          .string()
          .describe(
            "Session identifier returned by puppeteer_connect_active_tab",
          ),
        tabId: z
          .string()
          .describe(
            "Tab identifier returned by puppeteer_connect_active_tab or puppeteer_open_tab",
          ),
        selector: z.string().describe("CSS selector of the element to click"),
        timeout: z
          .number()
          .optional()
          .describe("Wait for selector timeout in ms (default: 30000)"),
      }),
    },
    async ({ sessionId, tabId, selector, timeout }) => {
      try {
        const page = await getPage(sessionId, tabId);
        await page.waitForSelector(selector, { timeout: timeout ?? 30000 });
        await page.click(selector);
        return {
          content: [
            {
              type: "text" as const,
              text: `Clicked: ${selector}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to click ${selector}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
};
