# MCP Streamable Puppeteer

MCP server using Streamable HTTP transport for Puppeteer browser automation. Connects to any Chrome DevTools Protocol–compatible browser (chromedp/headless-shell, Brave, etc.) and exposes tools for navigation, screenshots, clicks, form filling, and more. Built with **Bun**.

## Quick Start

```bash
docker compose up headless-shell -d   # Start browser
bun run dev                           # Start MCP server
```

- **Health:** http://localhost:8000/health  
- **MCP endpoint:** http://localhost:8000/mcp (Streamable HTTP)

## LM Studio

Add to `mcp.json`:

```json
{
  "mcpServers": {
    "puppeteer": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `puppeteer_navigate` | **Entrypoint.** Navigate to URL. Omit sessionId/tabId to create session + tab. Returns JSON with `sessionId`, `tabId`. |
| `puppeteer_active_tabs` | Connect to browser, list open tabs with `sessionId` and `tabId`s. |
| `puppeteer_close_tab` | Close a tab. |
| `puppeteer_close` | Close session (disconnect). |
| `puppeteer_get_content` | Get HTML (full page or selector). Returns `{ html, selector?, nextStep }`. |
| `puppeteer_screenshot` | Screenshot tab or element. Returns metadata + base64 image. |
| `puppeteer_click` | Click element by CSS selector. |
| `puppeteer_fill` | Fill input (use `fast: true` for direct value). |
| `puppeteer_select` | Select option in `<select>`. |
| `puppeteer_hover` | Hover over element. |
| `puppeteer_evaluate` | Run JavaScript in tab, return `{ result, consoleOutput? }`. |

**Flow:** `puppeteer_navigate` → use `sessionId`/`tabId` with other tools → `puppeteer_close`.

All tools return structured JSON (`status`, `nextStep`, `sessionId`/`tabId` where relevant) for LLM parsing.

## CLI

Direct tool calls without an LLM:

```bash
bun scripts/cli.ts get-content https://example.com
bun scripts/cli.ts get-content https://example.com --selector "#main"
bun scripts/cli.ts screenshot https://example.com -o out.png
bun scripts/cli.ts eval https://example.com "return document.title"
```

Requires `docker compose up headless-shell -d` and `bun run dev`. See [scripts/README.md](scripts/README.md).

## Docker Compose

- **headless-shell** + **mcp-streamable-puppeteer**: MCP shares network with headless-shell via `network_mode: service:mcp-streamable-puppeteer`; browser at localhost:9222.
- **brave** (profile): `docker compose --profile brave up`

```bash
docker compose up --build
```

## Local Development

```bash
bun install
bun run dev
```

Connects to localhost:9222. Run a CDP browser (e.g. Brave with `--remote-debugging-port=9222`) or use Docker.

## Tests

```bash
docker compose up headless-shell -d
bun test tests/
```

- `puppeteer-cdp.test.ts`, `puppeteer-brave.test.ts` — session layer (skip if browser unreachable)
- `mcp-integration.test.ts` — full MCP protocol
- `e2e-smoke.ts` — optional LLM-driven smoke (`bun run test:smoke`)
