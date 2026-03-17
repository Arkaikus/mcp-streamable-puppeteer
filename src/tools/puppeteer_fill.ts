import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureBrowser } from "../browser";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_fill",
    {
      description: "Fill an input field with a value",
      inputSchema: z.object({
        selector: z.string().describe("CSS selector of the input element"),
        value: z.string().describe("Value to type into the element"),
      }),
    },
    async ({ selector, value }) => {
      try {
        const page = await ensureBrowser();
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
