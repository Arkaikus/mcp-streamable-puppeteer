import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { connectSession } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_active_tabs",
    {
      description:
        "Connect to the browser (headless-shell or any CDP-compatible browser). " +
        "Returns a sessionId and the list of open tabs with their tabIds. " +
        "Use the sessionId and tabId with all other puppeteer tools.",
      inputSchema: z.object({
        sessionId: z
          .string()
          .optional()
          .describe(
            "Session identifier (reuses an existing connection when provided). " +
              "If omitted a new UUID is generated.",
          ),
        targetUrl: z
          .string()
          .optional()
          .describe(
            "Filter: only show tabs whose URL contains this string in the output. " +
              "The session still tracks all tabs; this only filters the displayed list.",
          ),
      }),
    },
    async ({ sessionId, targetUrl }) => {
      try {
        const sid = sessionId ?? crypto.randomUUID();
        const { tabs } = await connectSession(sid);
        const filtered = targetUrl
          ? tabs.filter((t) => t.url.includes(targetUrl))
          : tabs;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "success",
                sessionId: sid,
                tabs: filtered.map((t) => ({
                  tabId: t.tabId,
                  title: t.title,
                  url: t.url,
                })),
                tabCount: filtered.length,
                nextStep:
                  "Use sessionId and tabId with puppeteer_navigate, puppeteer_get_content, puppeteer_click, etc.",
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
                nextStep:
                  "Ensure the browser container (headless-shell or brave) is running with remote debugging on port 9222.",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
};
