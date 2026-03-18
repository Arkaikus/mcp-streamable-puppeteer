import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPage } from "../session";

export default (server: McpServer) => {
  server.registerTool(
    "puppeteer_fill",
    {
      description:
        "Fill an input field with a value in a specific browser tab. " +
        "Use fast=true for direct value assignment (faster, fewer events); default types character-by-character (realistic).",
      inputSchema: z.object({
        sessionId: z
          .string()
          .describe(
            "Session identifier returned by puppeteer_navigate or puppeteer_active_tabs",
          ),
        tabId: z
          .string()
          .describe(
            "Tab identifier returned by puppeteer_navigate or puppeteer_active_tabs",
          ),
        selector: z.string().describe("CSS selector of the input element"),
        value: z.string().describe("Value to type into the element"),
        fast: z
          .boolean()
          .optional()
          .describe(
            "If true, set value directly via evaluate (faster). If false/omitted, type character-by-character.",
          ),
        timeout: z
          .number()
          .optional()
          .describe("Wait for selector timeout in ms (default: 30000)"),
      }),
    },
    async ({ sessionId, tabId, selector, value, fast, timeout }) => {
      try {
        const page = await getPage(sessionId, tabId);
        await page.waitForSelector(selector, { timeout: timeout ?? 30000 });
        if (fast) {
          await page.evaluate(
            (sel, val) => {
              const el = document.querySelector(sel) as
                | HTMLInputElement
                | HTMLTextAreaElement
                | null;
              if (!el) throw new Error(`Element not found: ${sel}`);
              el.value = val;
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            },
            selector,
            value,
          );
        } else {
          await page.type(selector, value);
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                status: "success",
                action: "filled",
                selector,
                value,
                sessionId,
                tabId,
                nextStep:
                  "Use puppeteer_click to submit, or puppeteer_get_content to verify.",
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
                action: "fill",
                selector,
              }),
            },
          ],
          isError: true,
        };
      }
    },
  );
};
