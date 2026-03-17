# MCP Streamable HTTP Server (JavaScript)

An MCP server using Streamable HTTP transport that runs with Docker Compose and connects to LM Studio. Built with **Bun** (no Node, no npm).

## Running with Docker Compose

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
    "my-local-mcp": {
      "url": "http://localhost:8000/mcp"
    }
  }
}
```

After saving, your model will have access to the `add`, `greet`, and `reverse_text` tools.

## Local Development (with Bun)

```bash
bun install
bun run dev
```

## Adding Tools

Add more `mcpServer.registerTool()` calls in `src/index.ts` and rebuild:

```bash
docker compose up --build
```
