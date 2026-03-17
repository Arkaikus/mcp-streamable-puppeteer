/**
 * MCP protocol integration tests for mcp-streamable-puppeteer.
 * Tests the full stack: HTTP -> MCP protocol -> tool execution -> browser.
 *
 * This validates:
 * - Tool registration and discovery
 * - JSON-RPC message handling
 * - Zod schema validation
 * - MCP response formatting
 * - Browser connection and operations
 *
 * Requires headless-shell. Run first:
 *   docker compose up headless-shell -d
 *
 * Then: bun test tests/mcp-integration.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const HOST = process.env.CDP_HOST ?? "localhost";
const PORT = Number(process.env.CDP_PORT ?? 9222);

async function isBrowserReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://${HOST}:${PORT}/json/version`, {
      signal: controller.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

const BROWSER_REACHABLE = await isBrowserReachable();
if (!BROWSER_REACHABLE) {
  console.warn(
    `Skipping MCP integration tests: browser not reachable at ${HOST}:${PORT}. Run \`docker compose up headless-shell -d\` and ensure the debug port is accessible.`,
  );
}

const TEST_PAGE_HTML = `
<!DOCTYPE html>
<html>
<head><title>MCP Test</title></head>
<body>
  <h1 id="heading">Hello MCP</h1>
  <button id="click-me">Click me</button>
  <input id="input" type="text" value="initial" />
  <select id="dropdown">
    <option value="opt1">Option 1</option>
    <option value="opt2">Option 2</option>
  </select>
  <span id="output"></span>
  <script>
    document.getElementById('click-me').addEventListener('click', () => {
      document.getElementById('output').textContent = 'clicked';
    });
  </script>
</body>
</html>
`;

const TEST_PAGE_DATA_URL = `data:text/html;charset=utf-8,${encodeURIComponent(TEST_PAGE_HTML)}`;

let mcpClient: Client;
let mcpTransport: StreamableHTTPClientTransport;
let sessionId: string;
let tabId: string;
let serverProcess: { stop: () => void; port: number } | undefined;
let setupComplete = false;

describe.skipIf(!BROWSER_REACHABLE)("MCP Protocol Integration", () => {
  beforeAll(async () => {
    // Start the MCP server in-process on a random available port
    const app = await import("../src/index.js");
    serverProcess = Bun.serve({
      port: 0,
      fetch: app.default.fetch,
      idleTimeout: app.default.idleTimeout,
    });

    // Wait a bit for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Create MCP client with StreamableHTTPClientTransport
    mcpTransport = new StreamableHTTPClientTransport(
      new URL(`http://localhost:${serverProcess.port}/mcp`),
    );
    mcpClient = new Client(
      { name: "test-client", version: "1.0.0" },
      { capabilities: {} },
    );

    await mcpClient.connect(mcpTransport);
    setupComplete = true;
  });

  afterAll(async () => {
    if (!setupComplete) return;

    // Clean up: close tab if it exists
    if (sessionId && tabId) {
      try {
        await mcpClient.callTool({
          name: "puppeteer_close_tab",
          arguments: { sessionId, tabId },
        });
      } catch {
        // Tab may already be closed
      }
    }

    // Close MCP client
    await mcpClient.close();

    // Stop server
    if (serverProcess) {
      serverProcess.stop();
    }
  });

  test("lists all registered tools", async () => {
    const { tools } = await mcpClient.listTools();

    expect(tools.length).toBeGreaterThan(0);

    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("puppeteer_connect_active_tab");
    expect(toolNames).toContain("puppeteer_open_tab");
    expect(toolNames).toContain("puppeteer_close_tab");
    expect(toolNames).toContain("puppeteer_navigate");
    expect(toolNames).toContain("puppeteer_get_content");
    expect(toolNames).toContain("puppeteer_screenshot");
    expect(toolNames).toContain("puppeteer_click");
    expect(toolNames).toContain("puppeteer_fill");
    expect(toolNames).toContain("puppeteer_select");
    expect(toolNames).toContain("puppeteer_hover");
    expect(toolNames).toContain("puppeteer_evaluate");

    expect(tools.length).toBe(11);
  });

  test("tool schemas have proper structure", async () => {
    const { tools } = await mcpClient.listTools();

    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe("string");
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe("string");
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });

  test("connects to browser and gets session", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_connect_active_tab",
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    const textContent = result.content.find((c) => c.type === "text");
    expect(textContent).toBeDefined();
    expect(textContent?.text).toContain("Connected. sessionId=");

    // Extract sessionId from response
    const match = textContent?.text.match(/sessionId=([a-f0-9-]+)/);
    expect(match).toBeDefined();
    sessionId = match?.[1] ?? "";
    expect(sessionId).toBeDefined();
  });

  test("opens a new tab with data URL", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_open_tab",
      arguments: {
        sessionId,
        url: TEST_PAGE_DATA_URL,
      },
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();

    const textContent = result.content.find((c) => c.type === "text");
    expect(textContent?.text).toContain("Opened new tab");
    expect(textContent?.text).toContain("tabId=");

    // Extract tabId from response
    const match = textContent?.text.match(/tabId=([a-f0-9-]+)/);
    expect(match).toBeDefined();
    tabId = match?.[1] ?? "";
    expect(tabId).toBeDefined();
  });

  test("gets page content", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_get_content",
      arguments: {
        sessionId,
        tabId,
      },
    });

    expect(result.isError).toBeFalsy();
    const textContent = result.content.find((c) => c.type === "text");
    expect(textContent?.text).toContain("Hello MCP");
    expect(textContent?.text).toContain('id="heading"');
  });

  test("gets element content with selector", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_get_content",
      arguments: {
        sessionId,
        tabId,
        selector: "#heading",
      },
    });

    expect(result.isError).toBeFalsy();
    const textContent = result.content.find((c) => c.type === "text");
    expect(textContent?.text).toContain("Hello MCP");
  });

  test("takes a screenshot", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_screenshot",
      arguments: {
        sessionId,
        tabId,
        name: "test-screenshot",
      },
    });

    expect(result.isError).toBeFalsy();
    expect(result.content.length).toBeGreaterThan(0);

    const imageContent = result.content.find((c) => c.type === "image");
    expect(imageContent).toBeDefined();
    expect(imageContent?.mimeType).toBe("image/png");
    expect(imageContent?.data).toBeDefined();
    expect(typeof imageContent?.data).toBe("string");
    // Base64 encoded PNG should start with iVBOR
    expect(imageContent?.data.substring(0, 5)).toBe("iVBOR");
  });

  test("evaluates JavaScript in page", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_evaluate",
      arguments: {
        sessionId,
        tabId,
        script: "return document.title",
      },
    });

    expect(result.isError).toBeFalsy();
    const textContent = result.content.find((c) => c.type === "text");
    expect(textContent?.text).toContain("MCP Test");
  });

  test("clicks an element", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_click",
      arguments: {
        sessionId,
        tabId,
        selector: "#click-me",
      },
    });

    expect(result.isError).toBeFalsy();

    // Verify click worked by checking output
    const evalResult = await mcpClient.callTool({
      name: "puppeteer_evaluate",
      arguments: {
        sessionId,
        tabId,
        script: "return document.getElementById('output').textContent",
      },
    });

    const textContent = evalResult.content.find((c) => c.type === "text");
    expect(textContent?.text).toContain("clicked");
  });

  test("fills an input", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_fill",
      arguments: {
        sessionId,
        tabId,
        selector: "#input",
        value: "test value",
      },
    });

    expect(result.isError).toBeFalsy();

    // Verify fill worked
    const evalResult = await mcpClient.callTool({
      name: "puppeteer_evaluate",
      arguments: {
        sessionId,
        tabId,
        script: "return document.getElementById('input').value",
      },
    });

    const textContent = evalResult.content.find((c) => c.type === "text");
    expect(textContent?.text).toContain("test value");
  });

  test("selects dropdown option", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_select",
      arguments: {
        sessionId,
        tabId,
        selector: "#dropdown",
        value: "opt2",
      },
    });

    expect(result.isError).toBeFalsy();

    // Verify selection worked
    const evalResult = await mcpClient.callTool({
      name: "puppeteer_evaluate",
      arguments: {
        sessionId,
        tabId,
        script: "return document.getElementById('dropdown').value",
      },
    });

    const textContent = evalResult.content.find((c) => c.type === "text");
    expect(textContent?.text).toContain("opt2");
  });

  test("hovers over element", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_hover",
      arguments: {
        sessionId,
        tabId,
        selector: "#heading",
      },
    });

    expect(result.isError).toBeFalsy();
    const textContent = result.content.find((c) => c.type === "text");
    expect(textContent?.text).toContain("Hovered");
  });

  test("navigates to a new URL", async () => {
    const newPageHtml = `
<!DOCTYPE html>
<html>
<head><title>New Page</title></head>
<body><h1>New Content</h1></body>
</html>
`;
    const newPageUrl = `data:text/html;charset=utf-8,${encodeURIComponent(newPageHtml)}`;

    const result = await mcpClient.callTool({
      name: "puppeteer_navigate",
      arguments: {
        sessionId,
        tabId,
        url: newPageUrl,
      },
    });

    expect(result.isError).toBeFalsy();
    const textContent = result.content.find((c) => c.type === "text");
    expect(textContent?.text).toContain("Successfully navigated");

    // Verify navigation worked
    const contentResult = await mcpClient.callTool({
      name: "puppeteer_get_content",
      arguments: {
        sessionId,
        tabId,
      },
    });

    const content = contentResult.content.find((c) => c.type === "text");
    expect(content?.text).toContain("New Content");
  });

  test("handles errors gracefully - invalid session", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_get_content",
      arguments: {
        sessionId: "invalid-session-id",
        tabId: "invalid-tab-id",
      },
    });

    expect(result.isError).toBe(true);
    const textContent = result.content.find((c) => c.type === "text");
    expect(textContent?.text).toContain("Session");
    expect(textContent?.text).toContain("not found");
  });

  test("handles errors gracefully - invalid selector", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_click",
      arguments: {
        sessionId,
        tabId,
        selector: "#non-existent-element",
        timeout: 1000,
      },
    });

    expect(result.isError).toBe(true);
    const textContent = result.content.find((c) => c.type === "text");
    expect(textContent?.text.toLowerCase()).toContain("failed");
  });

  test("closes tab successfully", async () => {
    const result = await mcpClient.callTool({
      name: "puppeteer_close_tab",
      arguments: {
        sessionId,
        tabId,
      },
    });

    expect(result.isError).toBeFalsy();
    const textContent = result.content.find((c) => c.type === "text");
    expect(textContent?.text).toContain("Closed tab");
    expect(textContent?.text).toContain("tabId=");

    // Clear tabId so afterAll doesn't try to close it again
    tabId = "";
  });
});
