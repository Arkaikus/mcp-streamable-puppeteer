import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureBrowser } from "../browser";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_hover",
    {
      description: "Hover the mouse over an element in the browser",
      inputSchema: z.object({
        selector: z.string().describe("CSS selector of the element to hover over"),
      }),
    },
    async ({ selector }) => {
      try {
        const page = await ensureBrowser();
        await page.waitForSelector(selector);
        await page.hover(selector);
        return {
          content: [
            {
              type: "text" as const,
              text: `Hovered ${selector}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to hover ${selector}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
};
