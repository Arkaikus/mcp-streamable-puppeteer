import { StreamableHTTPTransport } from "@hono/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  puppeteerActiveTabs,
  puppeteerClick,
  puppeteerClose,
  puppeteerCloseTab,
  puppeteerEvaluate,
  puppeteerFill,
  puppeteerGetContent,
  puppeteerHover,
  puppeteerNavigate,
  puppeteerScreenshot,
  puppeteerSelect,
} from "./tools";

const app = new Hono();

function createMcpServer() {
  const server = new McpServer({
    name: "mcp-streamable-puppeteer",
    version: "1.0.0",
  });
  puppeteerActiveTabs(server);
  puppeteerCloseTab(server);
  puppeteerClose(server);
  puppeteerGetContent(server);
  puppeteerNavigate(server);
  puppeteerScreenshot(server);
  puppeteerClick(server);
  puppeteerFill(server);
  puppeteerSelect(server);
  puppeteerHover(server);
  puppeteerEvaluate(server);
  return server;
}

app.get("/health", async (c) => {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://localhost:9222/json/version`, {
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error(`Browser unreachable: ${res.status} ${res.statusText}`);
  } catch (error) {
    return c.json({ status: "degraded", browser: "unreachable" }, 503);
  }
  return c.json({ status: "ok", browser: "connected" });
});

// Streamable HTTP, JSON-only (matches Python json_response=True) - no SSE for MCP protocol.
// LM Studio's client always tries GET first and treats 405/400 as fatal, so we return 200 with
// a minimal keep-alive SSE stream. All actual MCP communication is via POST with JSON responses.
app.get("/mcp", (c) =>
  streamSSE(c, async (stream) => {
    const keepAlive = setInterval(
      () => stream.writeSSE({ data: "", event: "ping" }),
      30_000,
    );
    stream.onAbort(() => clearInterval(keepAlive));
    await new Promise<never>(() => {}); // keep stream open
  }),
);

app.post("/mcp", async (c) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true, // JSON-only
  });
  await server.connect(transport);
  return transport.handleRequest(c);
});

const port = Number(Bun.env.PORT) || 8000;

export default {
  port,
  fetch: app.fetch,
};
