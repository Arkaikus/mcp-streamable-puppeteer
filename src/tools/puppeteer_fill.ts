import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPage } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_fill",
    {
      description: "Fill an input field with a value in a specific browser tab",
      inputSchema: z.object({
        sessionId: z.string().describe("Session identifier returned by puppeteer_connect_active_tab"),
        tabId: z.string().describe("Tab identifier returned by puppeteer_connect_active_tab or puppeteer_open_tab"),
        selector: z.string().describe("CSS selector of the input element"),
        value: z.string().describe("Value to type into the element"),
      }),
    },
    async ({ sessionId, tabId, selector, value }) => {
      try {
        const page = await getPage(sessionId, tabId);
        await page.waitForSelector(selector);
        await page.type(selector, value);
        return {
          content: [
            {
              type: "text" as const,
              text: `Filled ${selector} with: ${value}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to fill ${selector}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
};
