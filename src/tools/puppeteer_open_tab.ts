import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { openTab } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_open_tab",
    {
      description:
        "Open a new browser tab in the given session. " +
        "Optionally navigates to a URL immediately. Returns the new tabId.",
      inputSchema: z.object({
        sessionId: z.string().describe("Session identifier returned by puppeteer_connect_active_tab"),
        url: z
          .string()
          .optional()
          .describe("URL to navigate to after opening the tab (optional)"),
      }),
    },
    async ({ sessionId, url }) => {
      try {
        const { tabId, url: finalUrl } = await openTab(sessionId, url);
        return {
          content: [
            {
              type: "text" as const,
              text: `Opened new tab. tabId=${tabId}  url=${finalUrl}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to open tab: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
};
