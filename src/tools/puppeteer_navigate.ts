import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { connectSession, getPage, openTab } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_navigate",
    {
      description:
        "Main entrypoint: navigate to a URL. When sessionId and tabId are omitted, creates a new session and tab, then navigates. " +
        "When provided, navigates the existing tab. Set failOn4xx=false to allow 4xx responses (e.g. SPAs that serve 404 for client routes).",
      inputSchema: z.object({
        url: z.string().describe("URL to navigate to"),
        sessionId: z
          .string()
          .optional()
          .describe(
            "Session identifier (omit to create new session + tab as main entrypoint)",
          ),
        tabId: z
          .string()
          .optional()
          .describe(
            "Tab identifier (omit with sessionId to create new tab; omit both to start fresh)",
          ),
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
    async ({ url, sessionId, tabId, timeout, failOn4xx = true }) => {
      try {
        const navTimeout = timeout ?? 30000;
        let sid = sessionId;
        let tid = tabId;
        let isNewSession = false;

        if (!sid) {
          sid = crypto.randomUUID();
          await connectSession(sid);
          const { tabId: newTabId } = await openTab(sid, url, navTimeout);
          tid = newTabId;
          isNewSession = true;
        } else if (!tid) {
          const { tabId: newTabId } = await openTab(sid, url, navTimeout);
          tid = newTabId;
        } else {
          const page = await getPage(sid, tid);
          const response = await page.goto(url, {
            waitUntil: "networkidle0",
            timeout: navTimeout,
          });
          if (!response) throw new Error("Navigation failed - no response received");
          const status = response.status();
          if (failOn4xx && status >= 400) {
            throw new Error(`HTTP error: ${status} ${response.statusText()}`);
          }
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  status: "success",
                  url,
                  statusCode: status,
                  sessionId: sid,
                  tabId: tid,
                  nextStep:
                    "Use sessionId and tabId with puppeteer_get_content, puppeteer_click, puppeteer_screenshot, etc.",
                }),
              },
            ],
          };
        }

        // openTab already navigated to url
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "success",
                url,
                sessionId: sid,
                tabId: tid,
                nextStep: isNewSession
                  ? "Use sessionId and tabId with puppeteer_get_content, puppeteer_click, puppeteer_screenshot, etc."
                  : "Use sessionId and tabId for subsequent operations.",
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
                action: "navigate",
                nextStep: "Retry with a valid URL or check browser is running.",
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
};
