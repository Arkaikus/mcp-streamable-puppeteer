/**
 * End-to-end smoke test with LLM integration.
 *
 * This validates the full chain as an end user would experience it:
 * LLM -> MCP protocol -> browser automation
 *
 * Prerequisites:
 * 1. Install OpenAI SDK: bun add -d openai
 * 2. Start headless-shell: docker compose up headless-shell -d
 * 3. Start MCP server: bun run dev (in another terminal)
 * 4. Start LM Studio with a model loaded and API server running on http://localhost:1234
 *
 * Run: bun run tests/e2e-smoke.ts
 *
 * Note: This is a smoke test, not a deterministic test suite.
 * LLM behavior may vary between runs.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type OpenAI from "openai";

const LM_STUDIO_URL = process.env.LM_STUDIO_URL ?? "http://localhost:1234/v1";
const MCP_URL = process.env.MCP_URL ?? "http://localhost:8000/mcp";
interface Tool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

async function convertMcpToolsToOpenAI(
  tools: Tool[],
): Promise<OpenAI.ChatCompletionTool[]> {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

async function runSmokeTest() {
  console.log("🚀 Starting E2E smoke test with LLM integration\n");

  // Dynamic import to handle optional dependency
  let OpenAI: typeof import("openai").default;
  try {
    const openaiModule = await import("openai");
    OpenAI = openaiModule.default;
  } catch (error) {
    console.error(
      "❌ OpenAI SDK not found. Install it with: bun add -d openai",
    );
    process.exit(1);
  }

  // Initialize LLM client (LM Studio with OpenAI-compatible API)
  const llm = new OpenAI({
    baseURL: LM_STUDIO_URL,
    apiKey: "lm-studio", // LM Studio doesn't require a real key
  });

  console.log(`📡 Connecting to LM Studio at ${LM_STUDIO_URL}`);

  // Test LLM connection and get model to use
  let modelId = "local-model";
  try {
    const models = await llm.models.list();
    console.log(
      `✅ LM Studio connected. Available models: ${models.data.length}`,
    );
    if (models.data.length === 0) {
      console.error(
        "❌ No models loaded in LM Studio. Please load a model first.",
      );
      process.exit(1);
    }
    // Use first available model (LM Studio typically has one loaded)
    modelId = models.data[0].id ?? modelId;
    console.log(`   Using model: ${modelId}`);
  } catch (error) {
    console.error(`❌ Failed to connect to LM Studio: ${error}`);
    console.error("   Make sure LM Studio is running with API server enabled.");
    process.exit(1);
  }

  // Initialize MCP client
  console.log(`\n📡 Connecting to MCP server at ${MCP_URL}`);
  const mcpTransport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const mcpClient = new Client(
    { name: "e2e-smoke-test", version: "1.0.0" },
    { capabilities: {} },
  );

  try {
    await mcpClient.connect(mcpTransport);
    console.log("✅ MCP client connected");
  } catch (error) {
    console.error(`❌ Failed to connect to MCP server: ${error}`);
    console.error("   Make sure the MCP server is running: bun run dev");
    process.exit(1);
  }

  // Pre-check: verify MCP server can connect to browser (more reliable than raw fetch)
  console.log("\n📡 Verifying MCP server can connect to browser...");
  const connectResult = await mcpClient.callTool({
    name: "puppeteer_active_tabs",
    arguments: {},
  });
  if (connectResult.isError) {
    const errText =
      connectResult.content.find((c) => c.type === "text")?.text ?? "";
    console.error("❌ MCP server cannot connect to browser.");
    console.error(`   ${errText.substring(0, 200)}...`);
    console.error("   Ensure: docker compose up headless-shell -d");
    await mcpClient.close();
    process.exit(1);
  }
  console.log("✅ MCP server can connect to browser");

  // Extract sessionId from pre-check (LLM can skip connect step)
  const connectText =
    connectResult.content.find((c) => c.type === "text")?.text ?? "";
  let preCheckSessionId: string | undefined;
  try {
    const parsed = JSON.parse(connectText) as { sessionId?: string };
    preCheckSessionId = parsed.sessionId;
  } catch {
    preCheckSessionId = connectText.match(/sessionId=([a-f0-9-]+)/)?.[1];
  }

  // Get available tools from MCP
  const { tools } = await mcpClient.listTools();
  console.log(`✅ Found ${tools.length} MCP tools`);

  // Convert MCP tools to OpenAI format
  const openaiTools = await convertMcpToolsToOpenAI(tools);

  // Test scenario: Use a minimal data URL to avoid exceeding model context
  const minimalHtml =
    "<html><body><h1>Test</h1><button id=btn>Click</button><div id=out></div><script>document.getElementById('btn').onclick=()=>{document.getElementById('out').textContent='ok'}</script></body></html>";
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(minimalHtml)}`;

  const sessionHint = preCheckSessionId
    ? `Session already connected. Use sessionId="${preCheckSessionId}" for all tools. `
    : "";

  const testTask = `You are a browser automation assistant. ${sessionHint}Do these steps:
1. Call puppeteer_navigate with url: "${dataUrl}"
2. Call puppeteer_click with sessionId, tabId, selector: "#btn"
3. Call puppeteer_evaluate with sessionId, tabId, script: "return document.getElementById('out').textContent" to verify it says "ok"
4. Call puppeteer_close_tab with sessionId and tabId
Use sessionId and tabId from tool responses. When done, reply with a brief summary.`;

  console.log("\n🤖 Sending task to LLM...\n");

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "You are a browser automation assistant. Use the available tools to complete tasks. " +
        "Always use the sessionId and tabId from previous tool calls. " +
        "When you've completed all steps, respond with a summary.",
    },
    {
      role: "user",
      content: testTask,
    },
  ];

  let iteration = 0;
  const maxIterations = 20;
  const maxConsecutiveErrors = 3;
  let consecutiveErrors = 0;
  let success = false;
  let sessionId: string | undefined;
  let tabId: string | undefined;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n--- Iteration ${iteration} ---`);

    const response = await llm.chat.completions.create({
      model: modelId,
      messages,
      tools: openaiTools,
      tool_choice: "auto",
    });

    const message = response.choices[0].message;
    messages.push(message);

    // Check if LLM wants to call tools
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`🔧 LLM wants to call ${message.tool_calls.length} tool(s)`);

      let shouldStop = false;
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        console.log(`   📞 Calling ${toolName}`);
        console.log(`      Args: ${JSON.stringify(toolArgs, null, 2)}`);

        try {
          const result = await mcpClient.callTool({
            name: toolName,
            arguments: toolArgs,
          });

          if (result.isError) {
            consecutiveErrors++;
            if (consecutiveErrors >= maxConsecutiveErrors) {
              console.error(
                `\n❌ ${maxConsecutiveErrors} consecutive tool errors. Stopping.`,
              );
              shouldStop = true;
              break;
            }
          } else {
            consecutiveErrors = 0;
          }

          // Extract sessionId and tabId from responses
          const textContent = result.content.find((c) => c.type === "text");
          const text = textContent?.text ?? "";
          if (toolName === "puppeteer_active_tabs" || toolName === "puppeteer_navigate") {
            try {
              const parsed = JSON.parse(text) as { sessionId?: string; tabId?: string };
              if (parsed.sessionId) {
                sessionId = parsed.sessionId;
                console.log(`      ✅ Got sessionId: ${sessionId}`);
              }
              if (parsed.tabId) {
                tabId = parsed.tabId;
                console.log(`      ✅ Got tabId: ${tabId}`);
              }
            } catch {
              const sidMatch = text.match(/sessionId=([a-f0-9-]+)/);
              const tabMatch = text.match(/tabId=([a-f0-9-]+)/);
              if (sidMatch) sessionId = sidMatch[1];
              if (tabMatch) tabId = tabMatch[1];
            }
          }

          // Format result for LLM
          const resultText = result.content
            .map((c) => {
              if (c.type === "text") {
                return c.text;
              }
              if (c.type === "image") {
                return `[Screenshot taken: ${c.mimeType}, ${c.data.length} bytes]`;
              }
              return JSON.stringify(c);
            })
            .join("\n");

          console.log(`      ✅ Result: ${resultText.substring(0, 100)}...`);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result.isError ? `Error: ${resultText}` : resultText,
          });
        } catch (error) {
          consecutiveErrors++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          console.log(`      ❌ Error: ${errorMsg}`);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: `Error: ${errorMsg}`,
          });
          if (consecutiveErrors >= maxConsecutiveErrors) {
            console.error(
              `\n❌ ${maxConsecutiveErrors} consecutive errors. Stopping.`,
            );
            shouldStop = true;
            break;
          }
        }
      }
      if (shouldStop) break;
    } else {
      // LLM is done
      success = true;
      console.log("\n✅ LLM finished. Final response:");
      console.log(message.content);
      break;
    }

    if (iteration >= maxIterations) {
      console.log("\n⚠️  Reached max iterations. Stopping.");
    }
  }

  // Cleanup
  console.log("\n🧹 Cleaning up...");
  if (sessionId && tabId) {
    try {
      await mcpClient.callTool({
        name: "puppeteer_close_tab",
        arguments: { sessionId, tabId },
      });
      console.log("✅ Tab closed");
    } catch (error) {
      console.log("⚠️  Tab may already be closed");
    }
  }

  await mcpClient.close();
  console.log("✅ MCP client closed");

  if (success) {
    console.log("\n🎉 Smoke test completed!");
  } else {
    console.log("\n⚠️  Smoke test did not complete successfully.");
    process.exit(1);
  }
}

// Run the smoke test
runSmokeTest().catch((error) => {
  console.error("\n❌ Smoke test failed:");
  console.error(error);
  process.exit(1);
});
