import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { connectSession } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_connect_active_tab",
    {
      description:
        "Connect to the Brave browser running in the docker-brave container. " +
        "Returns a sessionId and the list of open tabs with their tabIds. " +
        "Use the sessionId and tabId with all other puppeteer tools.",
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe(
            "Session identifier (reuses an existing connection when provided). " +
            "If omitted a new UUID is generated."
          ),
        debugHost: z
          .string()
          .optional()
          .describe("Remote debugging host (default: BROWSER_DEBUG_HOST env or localhost)"),
        debugPort: z
          .number()
          .optional()
          .describe("Remote debugging port (default: BROWSER_DEBUG_PORT env or 9222)"),
        targetUrl: z
          .string()
          .optional()
          .describe("Filter: only return tabs whose URL contains this string"),
      }),
    },
    async ({ sessionId, debugHost, debugPort, targetUrl }) => {
      try {
        const sid = sessionId ?? crypto.randomUUID(); // crypto guaranteed by Bun runtime
        const host = debugHost ?? Bun.env.BROWSER_DEBUG_HOST ?? "localhost";
        const port = debugPort ?? Number(Bun.env.BROWSER_DEBUG_PORT ?? 9222);

        const { tabs } = await connectSession(sid, host, port);
        const filtered = targetUrl ? tabs.filter((t) => t.url.includes(targetUrl)) : tabs;

        const tabLines = filtered
          .map((t) => `  • tabId=${t.tabId}  ${t.title} (${t.url})`)
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text:
                `Connected. sessionId=${sid}\n` +
                `Open tabs (${filtered.length}):\n${tabLines || "  (none)"}`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text:
                `Failed to connect to browser: ${message}\n\n` +
                "Ensure the docker-brave container is running with remote debugging enabled:\n" +
                "  BRAVE_CLI=--remote-debugging-port=9222 --remote-debugging-address=0.0.0.0",
            },
          ],
          isError: true,
        };
      }
    }
  );
};
