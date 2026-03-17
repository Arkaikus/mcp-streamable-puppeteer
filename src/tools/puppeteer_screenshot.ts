import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPage } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_screenshot",
    {
      description:
        "Take a screenshot of a specific browser tab or one of its elements",
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
        name: z.string().describe("Name for the screenshot"),
        selector: z
          .string()
          .optional()
          .describe(
            "CSS selector of the element to screenshot (optional, defaults to full page)",
          ),
        width: z
          .number()
          .optional()
          .describe("Viewport width in pixels (default: 800)"),
        height: z
          .number()
          .optional()
          .describe("Viewport height in pixels (default: 600)"),
      }),
    },
    async ({ sessionId, tabId, name, selector, width, height }) => {
      try {
        const page = await getPage(sessionId, tabId);
        const vw = width ?? 800;
        const vh = height ?? 600;
        const previousViewport = page.viewport();
        try {
          await page.setViewport({ width: vw, height: vh });

          let screenshot: string | undefined;

          if (selector) {
            const element = await page.$(selector);
            if (!element) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: `Element not found: ${selector}`,
                  },
                ],
                isError: true,
              };
            }
            screenshot = (await element.screenshot({
              encoding: "base64",
            })) as string;
          } else {
            screenshot = (await page.screenshot({
              encoding: "base64",
              fullPage: false,
            })) as string;
          }

          return {
            content: [
              {
                type: "text" as const,
                text: `Screenshot '${name}' taken at ${vw}x${vh}`,
              },
              {
                type: "image" as const,
                data: screenshot,
                mimeType: "image/png",
              },
            ],
          };
        } finally {
          if (previousViewport) {
            await page.setViewport(previousViewport);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text" as const,
              text: `Screenshot failed: ${message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
};
