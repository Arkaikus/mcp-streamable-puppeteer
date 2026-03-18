import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { closeSession } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_close",
    {
      description:
        "Close a browser session. Disconnects from the browser and frees resources.",
      inputSchema: z.object({
        sessionId: z
          .string()
          .describe(
            "Session identifier to close (returned by puppeteer_navigate or puppeteer_active_tabs)",
          ),
      }),
    },
    async ({ sessionId }) => {
      try {
        await closeSession(sessionId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "success",
                action: "closed_session",
                sessionId,
                nextStep: "Call puppeteer_navigate to start a new session.",
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
                action: "close_session",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
};
