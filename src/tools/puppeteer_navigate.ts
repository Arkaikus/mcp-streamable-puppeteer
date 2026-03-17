import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPage } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_navigate",
    {
      description: "Navigate a specific browser tab to a URL",
      inputSchema: z.object({
        sessionId: z.string().describe("Session identifier returned by puppeteer_connect_active_tab"),
        tabId: z.string().describe("Tab identifier returned by puppeteer_connect_active_tab or puppeteer_open_tab"),
        url: z.string().describe("URL to navigate to"),
      }),
    },
    async ({ sessionId, tabId, url }) => {
      try {
        const page = await getPage(sessionId, tabId);
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
