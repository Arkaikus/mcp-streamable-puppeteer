# Agent Guidelines

## Project

MCP server for Puppeteer browser automation. Bun + Hono + MCP SDK. Connects to CDP browsers at localhost:9222.

## Conventions

- **Tools:** Return structured JSON (`status`, `nextStep`, `sessionId`/`tabId` where relevant). Errors use `{ status: "error", error, action? }`.
- **Session:** `src/session.ts` manages browser connections. Tools use `connectSession`, `getPage`, `openTab`, `closeTab`, `closeSession`.
- **Entrypoint:** `puppeteer_navigate` creates session+tab when sessionId/tabId omitted. `puppeteer_close` ends session.

## Testing

- `bun test tests/` — requires `docker compose up headless-shell -d`
- Tests skip when browser unreachable
- MCP integration tests parse JSON responses

## Key Paths

- `src/tools/` — MCP tool implementations
- `src/session.ts` — browser/session logic
- `scripts/cli.ts` — CLI for direct tool calls
