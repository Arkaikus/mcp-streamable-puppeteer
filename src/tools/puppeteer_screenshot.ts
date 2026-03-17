import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ensureBrowser } from "../browser";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_screenshot",
    {
      description: "Take a screenshot of the current page or a specific element",
      inputSchema: z.object({
        name: z.string().describe("Name for the screenshot"),
        selector: z
          .string()
          .optional()
          .describe("CSS selector of the element to screenshot (optional, defaults to full page)"),
        width: z.number().optional().describe("Viewport width in pixels (default: 800)"),
        height: z.number().optional().describe("Viewport height in pixels (default: 600)"),
      }),
    },
    async ({ name, selector, width, height }) => {
      try {
        const page = await ensureBrowser();
        const vw = width ?? 800;
        const vh = height ?? 600;
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
          screenshot = (await element.screenshot({ encoding: "base64" })) as string;
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
    }
  );
};
