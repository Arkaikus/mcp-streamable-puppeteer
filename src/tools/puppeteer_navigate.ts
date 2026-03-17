import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPage } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_navigate",
    {
      description:
        "Navigate a specific browser tab to a URL. " +
        "Set failOn4xx=false to allow 4xx responses (e.g. SPAs that serve 404 for client routes).",
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
        url: z.string().describe("URL to navigate to"),
        timeout: z
          .number()
          .optional()
          .describe("Navigation timeout in ms (default: 30000)"),
        failOn4xx: z
          .boolean()
          .optional()
          .describe(
            "If true (default), throw on HTTP 4xx. If false, allow 4xx (e.g. SPA 404).",
          ),
      }),
    },
    async ({ sessionId, tabId, url, timeout, failOn4xx = true }) => {
      try {
        const page = await getPage(sessionId, tabId);
        const response = await page.goto(url, {
          waitUntil: "networkidle0",
          timeout: timeout ?? 30000,
        });

        if (!response) {
          throw new Error("Navigation failed - no response received");
        }

        const status = response.status();
        if (failOn4xx && status >= 400) {
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
    },
  );
};
