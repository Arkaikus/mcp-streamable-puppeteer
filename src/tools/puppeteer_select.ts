import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureBrowser } from "../browser";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_select",
    {
      description: "Select an option in a <select> element",
      inputSchema: z.object({
        selector: z.string().describe("CSS selector of the <select> element"),
        value: z.string().describe("Value of the option to select"),
      }),
    },
    async ({ selector, value }) => {
      try {
        const page = await ensureBrowser();
        await page.waitForSelector(selector);
        await page.select(selector, value);
        return {
          content: [
            {
              type: "text" as const,
              text: `Selected ${selector} with: ${value}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to select ${selector}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
};
