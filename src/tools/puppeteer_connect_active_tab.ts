import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getDebuggerWebSocketUrl,
  connectToExistingBrowser,
  setCurrentPage,
} from "../browser";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_connect_active_tab",
    {
      description:
        "Connect to the Brave browser running in the docker-brave container via remote debugging",
      inputSchema: z.object({
        debugPort: z
          .number()
          .optional()
          .describe("Remote debugging port (default: 9222)"),
        debugHost: z
          .string()
          .optional()
          .describe("Remote debugging host (default: BROWSER_DEBUG_HOST env or localhost)"),
        targetUrl: z
          .string()
          .optional()
          .describe("Optional URL to match a specific target/tab"),
      }),
    },
    async ({ debugPort, debugHost, targetUrl }) => {
      try {
        const host = debugHost ?? Bun.env.BROWSER_DEBUG_HOST ?? "localhost";
        const port = debugPort ?? Number(Bun.env.BROWSER_DEBUG_PORT ?? 9222);
        const wsEndpoint = await getDebuggerWebSocketUrl(host, port);
        const connectedBrowser = await connectToExistingBrowser(wsEndpoint);

        const pages = await connectedBrowser.pages();
        let page = pages[0];

        if (targetUrl && pages.length > 0) {
          const match = pages.find((p) => p.url().includes(targetUrl));
          if (match) page = match;
        }

        if (!page) {
          page = await connectedBrowser.newPage();
        }

        setCurrentPage(page);

        const url = page.url();
        const title = await page.title();

        return {
          content: [
            {
              type: "text" as const,
              text: `Successfully connected to Brave browser\nActive tab: ${title} (${url})`,
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to connect to browser: ${message}\n\nEnsure the docker-brave container is running with remote debugging enabled:\n  BRAVE_CLI=--remote-debugging-port=9222 --remote-debugging-address=0.0.0.0`,
            },
          ],
          isError: true,
        };
      }
    }
  );
};
