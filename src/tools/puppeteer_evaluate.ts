import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ConsoleMessage } from "puppeteer-core";
import { z } from "zod";
import { getPage } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_evaluate",
    {
      description:
        "Execute JavaScript in the context of a specific browser tab and return the result",
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
        script: z
          .string()
          .describe("JavaScript code to execute in the browser tab"),
      }),
    },
    async ({ sessionId, tabId, script }) => {
      try {
        const page = await getPage(sessionId, tabId);

        const logs: string[] = [];
        const consoleListener = (message: ConsoleMessage) => {
          logs.push(`${message.type()}: ${message.text()}`);
        };
        page.on("console", consoleListener);
        try {
          const result = await page.evaluate(`(async () => {
            try {
              return await (async function() { ${script} })();
            } catch (e) {
              console.error('Script execution error:', e.message);
              return { error: e.message };
            }
          })()`);

          return {
            content: [
              {
                type: "text" as const,
                text: `Execution result:\n${JSON.stringify(result, null, 2)}\n\nConsole output:\n${logs.join("\n")}`,
              },
            ],
          };
        } finally {
          page.off("console", consoleListener);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Script execution failed: ${message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
};
