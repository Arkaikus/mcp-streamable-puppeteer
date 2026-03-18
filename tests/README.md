# Testing Strategy

This directory contains three layers of tests for the mcp-streamable-puppeteer project, validating different aspects of the system.

## Test Layers

```
┌─────────────────────────────────────────────────┐
│  Layer 3: E2E Smoke (LLM-driven)                │
│  tests/e2e-smoke.ts                             │
│  LM Studio → MCP Client → MCP Server → Browser  │
└─────────────────────────────────────────────────┘
                      ▲
┌─────────────────────────────────────────────────┐
│  Layer 2: MCP Protocol Integration              │
│  tests/mcp-integration.test.ts                  │
│  MCP Client → MCP Server → Browser              │
└─────────────────────────────────────────────────┘
                      ▲
┌─────────────────────────────────────────────────┐
│  Layer 1: Session Module (Direct)               │
│  tests/puppeteer-cdp.test.ts                    │
│  tests/puppeteer-brave.test.ts                  │
│  Session functions → Browser                    │
└─────────────────────────────────────────────────┘
```

## Layer 1: Session Module Tests (Existing)

**Files:** `puppeteer-cdp.test.ts`, `puppeteer-brave.test.ts`

**What they test:**
- Direct session management functions (`connectSession`, `openTab`, `closeTab`, etc.)
- Browser connection and page operations
- Puppeteer-core integration with CDP

**When to run:**
- Fast unit-style tests for session logic
- Validates browser connectivity

**Run:**
```bash
# Start browser first
docker compose up headless-shell -d

# Run tests
bun test tests/puppeteer-cdp.test.ts
bun test tests/puppeteer-brave.test.ts
```

## Layer 2: MCP Protocol Integration Tests (New) ⭐

**File:** `mcp-integration.test.ts`

**What it tests:**
- Full MCP protocol stack (JSON-RPC over Streamable HTTP)
- Tool registration and discovery via `listTools()`
- Tool execution via `callTool()` through the MCP protocol
- Zod schema validation
- MCP response formatting (content arrays, error handling)
- All 11 MCP tools end-to-end

**Why this is important:**
- The existing tests bypass the MCP layer entirely
- This validates that tools are properly registered and callable via MCP
- Tests the stateless server pattern (new McpServer per request)
- Catches schema validation issues and response format bugs

**Run:**
```bash
# Start browser
docker compose up headless-shell -d

# Run MCP integration tests
bun run test:mcp

# Or run all tests
bun test
```

**What gets validated:**
- ✅ Tool registration and metadata
- ✅ Input schema validation (Zod)
- ✅ MCP response format (content arrays)
- ✅ Error handling and error responses
- ✅ Session management through MCP
- ✅ Browser operations through MCP
- ✅ Screenshot encoding (base64 PNG)
- ✅ JavaScript evaluation
- ✅ Form interactions (click, fill, select)

## Layer 3: E2E Smoke Test with LLM (Optional)

**File:** `e2e-smoke.ts`

**What it tests:**
- Full end-user experience: LLM decides which tools to call
- OpenAI-compatible API integration (LM Studio)
- Multi-step task execution with tool chaining
- Real-world usage patterns

**When to run:**
- Manual smoke testing before releases
- Validating LM Studio integration
- Demonstrating the system to stakeholders

**Prerequisites:**
1. Install OpenAI SDK: `bun add -d openai`
2. Start browser: `docker compose up headless-shell -d`
3. Start MCP server: `bun run dev` (in another terminal)
4. Start LM Studio with a model loaded and API server running

**Run:**
```bash
bun run test:smoke
```

**What it does:**
- Connects to LM Studio (OpenAI-compatible API)
- Fetches MCP tools and converts them to OpenAI format
- Sends a complex task to the LLM
- LLM autonomously calls tools to complete the task
- Validates the full chain works as end users experience it

**Note:** This is non-deterministic (LLM behavior varies) and slow (inference latency). Not suitable for CI/CD, but valuable for manual validation.

### Peoople User Profile Smoke Test (Real-world use case)

**File:** `e2e-smoke-peoople.ts`

**What it tests:**
- Same as above, but with a live site: https://peoople.app/en/users/auronplay/
- LLM navigates to the profile page, extracts content, and creates a summary of the user "auronplay"
- Validates network access, real page rendering, and content extraction

**Run:**
```bash
bun run test:smoke:peoople
```

**Optional env vars:**
- `PEOOPLE_PROFILE_URL` — override the profile URL (default: https://peoople.app/en/users/auronplay/)

## Running Tests

### Quick Start

```bash
# Start browser
docker compose up headless-shell -d

# Run all tests (Layer 1 + Layer 2)
bun test

# Run only MCP integration tests
bun run test:mcp

# Run E2E smoke test (requires LM Studio)
bun run test:smoke

# Run Peoople profile smoke test (requires LM Studio, network)
bun run test:smoke:peoople
```

### CI/CD Recommendations

**For CI:**
- Run Layer 1 (session tests) - fast, deterministic
- Run Layer 2 (MCP integration tests) - comprehensive, deterministic
- Skip Layer 3 (E2E smoke) - non-deterministic, requires LM Studio

**For manual testing:**
- Run all layers including E2E smoke test

## Test Coverage

### Layer 1 (Session Module)
- ✅ Browser connection
- ✅ Page content retrieval
- ✅ JavaScript evaluation
- ✅ Element clicks
- ✅ Input filling
- ✅ URL navigation

### Layer 2 (MCP Protocol) - NEW
- ✅ All 11 MCP tools
- ✅ Tool discovery (`listTools`)
- ✅ Tool execution (`callTool`)
- ✅ Input validation (Zod schemas)
- ✅ Response formatting
- ✅ Error handling
- ✅ Session lifecycle
- ✅ Screenshot encoding
- ✅ Form interactions
- ✅ JavaScript evaluation

### Layer 3 (E2E Smoke)
- ✅ LLM integration
- ✅ Multi-step task execution
- ✅ Tool chaining
- ✅ Real-world usage patterns

## Improvements from Previous Testing

**Before:**
- ❌ Only tested session module directly
- ❌ MCP protocol layer untested
- ❌ Tool registration untested
- ❌ Zod validation untested
- ❌ Response formatting untested
- ❌ Silent failures when browser unreachable

**After:**
- ✅ Full MCP protocol stack tested
- ✅ Tool registration validated
- ✅ Schema validation tested
- ✅ Response format verified
- ✅ Browser health checks with retry logic
- ✅ Proper docker-compose health gates
- ✅ Optional LLM integration smoke test

## Troubleshooting

### Browser not reachable
```bash
# Check if browser is running
docker compose ps

# Check browser health
curl http://localhost:9222/json/version

# Restart browser
docker compose restart headless-shell

# Check logs
docker compose logs headless-shell
```

### MCP server connection failed
```bash
# Make sure server is running
bun run dev

# Check server health
curl http://localhost:8000/health

# Check MCP endpoint
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","params":{},"id":1}'
```

### LM Studio connection failed (E2E smoke test)
```bash
# Check if LM Studio is running
curl http://localhost:1234/v1/models

# Make sure a model is loaded in LM Studio
# Enable "API Server" in LM Studio settings
```

## Architecture Notes

### Why Layer 2 is Critical

The existing tests (Layer 1) only test the session module directly:

```typescript
// Layer 1: Direct function calls (existing tests)
import { connectSession, openTab } from "../src/session";
const result = await connectSession(sessionId, host, port);
```

This completely bypasses:
- HTTP server (Hono app)
- MCP protocol handling (JSON-RPC)
- Tool registration
- Zod schema validation
- MCP response formatting

Layer 2 tests the full stack:

```typescript
// Layer 2: Through MCP protocol (new tests)
const mcpClient = new Client(/* ... */);
await mcpClient.connect(transport);
const result = await mcpClient.callTool({
  name: "puppeteer_active_tabs",
  arguments: {}
});
```

This validates:
- HTTP POST /mcp endpoint
- JSON-RPC message parsing
- Tool dispatch
- Input validation (Zod)
- Tool execution
- Response formatting
- Error handling

### Stateless Server Pattern

The MCP server creates a new `McpServer` instance per request:

```typescript
app.post("/mcp", async (c) => {
  const server = createMcpServer(); // New instance per request
  const transport = new StreamableHTTPTransport(/* ... */);
  await server.connect(transport);
  return transport.handleRequest(c);
});
```

This pattern is only tested by Layer 2 (MCP integration tests), not Layer 1 (session tests).

## Contributing

When adding new MCP tools:
1. Add unit tests in Layer 1 (session module) if needed
2. **Always add integration tests in Layer 2** (MCP protocol)
3. Update the E2E smoke test scenario if the tool is user-facing

When fixing bugs:
1. Add a failing test in the appropriate layer
2. Fix the bug
3. Verify the test passes
