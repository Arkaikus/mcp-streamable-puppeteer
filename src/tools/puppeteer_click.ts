import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureBrowser } from "../browser";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_click",
    {
      description: "Click on an element in the browser",
      inputSchema: z.object({
        selector: z.string().describe("CSS selector of the element to click"),
      }),
    },
    async ({ selector }) => {
      try {
        const page = await ensureBrowser();
        await page.waitForSelector(selector);
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
    }
  );
};
