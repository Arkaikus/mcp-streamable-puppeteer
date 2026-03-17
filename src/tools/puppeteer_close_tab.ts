import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { closeTab } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_close_tab",
    {
      description: "Close a specific browser tab in the given session.",
      inputSchema: z.object({
        sessionId: z.string().describe("Session identifier returned by puppeteer_connect_active_tab"),
        tabId: z.string().describe("Tab identifier returned by puppeteer_connect_active_tab or puppeteer_open_tab"),
      }),
    },
    async ({ sessionId, tabId }) => {
      try {
        await closeTab(sessionId, tabId);
        return {
          content: [
            {
              type: "text" as const,
              text: `Closed tab tabId=${tabId} in session ${sessionId}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to close tab: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
};
