import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureBrowser } from "../browser";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_navigate",
    {
      description: "Navigate the browser to a URL",
      inputSchema: z.object({
        url: z.string().describe("URL to navigate to"),
      }),
    },
    async ({ url }) => {
      try {
        const page = await ensureBrowser();
        const response = await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: 30000,
        });

        if (!response) {
          throw new Error("Navigation failed - no response received");
        }

        const status = response.status();
        if (status >= 400) {
          throw new Error(`HTTP error: ${status} ${response.statusText()}`);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully navigated to ${url} (Status: ${status})`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Navigation failed: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
};
