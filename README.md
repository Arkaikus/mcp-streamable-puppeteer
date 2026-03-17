# MCP Streamable Puppeteer Server

An MCP server using Streamable HTTP transport that provides Puppeteer browser automation. Connects to a Brave browser (or any Chrome DevTools Protocol–compatible browser) and exposes tools for navigation, screenshots, clicks, form filling, and more. Built with **Bun** (no Node, no npm).

## Running with Docker Compose

The stack includes Brave (with remote debugging) and the MCP server:

```bash
docker compose up --build
```

## Verify

- **Health check:** http://localhost:8000/health
- **MCP endpoint:** http://localhost:8000/mcp (Streamable HTTP)

## LM Studio Configuration

Open LM Studio → **Program tab** → **Install** → **Edit mcp.json** and add:

```json
{
  "mcpServers": {
    "puppeteer": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

After saving, your model will have access to the Puppeteer tools.

## Available Tools

| Tool | Description |
|------|-------------|
| `puppeteer_connect_active_tab` | Connect to the browser. Returns sessionId and list of open tabs with tabIds. Call this first. |
| `puppeteer_open_tab` | Open a new tab, optionally navigating to a URL. |
| `puppeteer_close_tab` | Close a specific tab. |
| `puppeteer_navigate` | Navigate a tab to a URL. |
| `puppeteer_get_content` | Get HTML content of a tab (full page or a selected element). |
| `puppeteer_screenshot` | Take a screenshot of a tab or element. |
| `puppeteer_click` | Click an element by CSS selector. |
| `puppeteer_fill` | Fill an input field (supports `fast` mode for direct value assignment). |
| `puppeteer_select` | Select an option in a `<select>` element. |
| `puppeteer_hover` | Hover over an element. |
| `puppeteer_evaluate` | Execute JavaScript in the tab context and return the result. |

Use `sessionId` and `tabId` from `puppeteer_connect_active_tab` with all other tools.

## Local Development (with Bun)

With a browser running with remote debugging (e.g. Brave with `--remote-debugging-port=9222`):

```bash
bun install
bun run dev
```

Set `BROWSER_DEBUG_HOST` and `BROWSER_DEBUG_PORT` if the browser is not on localhost:9222.
