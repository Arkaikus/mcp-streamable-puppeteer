import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPage } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_hover",
    {
      description: "Hover the mouse over an element in a specific browser tab",
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
          .describe("CSS selector of the element to hover over"),
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
        await page.hover(selector);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "success",
                action: "hovered",
                selector,
                sessionId,
                tabId,
                nextStep:
                  "Use puppeteer_click to click the hovered element, or puppeteer_get_content to inspect.",
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
                action: "hover",
                selector,
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
};
