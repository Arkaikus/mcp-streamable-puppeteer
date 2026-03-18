#!/usr/bin/env bun
/**
 * CLI for calling MCP puppeteer tools directly (no LLM).
 *
 * Prerequisites:
 * - docker compose up headless-shell -d
 * - bun run dev (MCP server)
 *
 * Usage:
 *   bun scripts/cli.ts get-content <url> [--selector <css>]
 *   bun scripts/cli.ts screenshot <url> [--output file.png] [--selector <css>]
 *   bun scripts/cli.ts eval <url> <script>
 *
 * Env vars:
 *   MCP_URL - MCP server URL (default: http://localhost:8000/mcp)
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_URL = process.env.MCP_URL ?? "http://localhost:8000/mcp";

function parseArgs(): {
  cmd: string;
  positional: string[];
  flags: { selector?: string; output?: string };
} {
  const args = process.argv.slice(2);
  const cmd = args[0] ?? "";
  const flags: { selector?: string; output?: string } = {};
  const positional: string[] = [];

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--selector" && args[i + 1]) {
      flags.selector = args[i + 1];
      i++;
    } else if ((args[i] === "--output" || args[i] === "-o") && args[i + 1]) {
      flags.output = args[i + 1];
      i++;
    } else {
      positional.push(args[i]);
    }
  }

  return { cmd, positional, flags };
}

async function createMcpClient() {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client(
    { name: "mcp-puppeteer-cli", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(transport);
  return client;
}

function extractNavigateResult(result: {
  content: { type: string; text?: string }[];
}): { sessionId?: string; tabId?: string } {
  const text = result.content.find((c) => c.type === "text")?.text ?? "";
  try {
    const parsed = JSON.parse(text) as { sessionId?: string; tabId?: string };
    return { sessionId: parsed.sessionId, tabId: parsed.tabId };
  } catch {
    const sid = text.match(/sessionId=([a-f0-9-]+)/)?.[1];
    const tab = text.match(/tabId=([a-f0-9-]+)/)?.[1];
    return { sessionId: sid, tabId: tab };
  }
}

async function runGetContent(url: string, selector?: string) {
  const client = await createMcpClient();

  const navRes = await client.callTool({
    name: "puppeteer_navigate",
    arguments: { url },
  });
  if (navRes.isError) {
    const err = navRes.content.find((c) => c.type === "text")?.text ?? "";
    throw new Error(`Navigate failed: ${err}`);
  }

  const { sessionId, tabId } = extractNavigateResult(navRes);
  if (!sessionId || !tabId) throw new Error("No sessionId/tabId in navigate response");

  const getRes = await client.callTool({
    name: "puppeteer_get_content",
    arguments: { sessionId, tabId, ...(selector && { selector }) },
  });

  await client.callTool({
    name: "puppeteer_close",
    arguments: { sessionId },
  }).catch(() => {});

  await client.close();

  if (getRes.isError) {
    const err = getRes.content.find((c) => c.type === "text")?.text ?? "";
    throw new Error(`Get content failed: ${err}`);
  }

  const parsed = JSON.parse(
    getRes.content.find((c) => c.type === "text")?.text ?? "{}",
  ) as { html?: string };
  return parsed.html ?? "";
}

async function runScreenshot(url: string, output?: string, selector?: string) {
  const client = await createMcpClient();

  const navRes = await client.callTool({
    name: "puppeteer_navigate",
    arguments: { url },
  });
  if (navRes.isError) {
    const err = navRes.content.find((c) => c.type === "text")?.text ?? "";
    throw new Error(`Navigate failed: ${err}`);
  }

  const { sessionId, tabId } = extractNavigateResult(navRes);
  if (!sessionId || !tabId) throw new Error("No sessionId/tabId in navigate response");

  const name = output ?? "screenshot";
  const screenRes = await client.callTool({
    name: "puppeteer_screenshot",
    arguments: { sessionId, tabId, name, ...(selector && { selector }) },
  });

  await client.callTool({
    name: "puppeteer_close",
    arguments: { sessionId },
  }).catch(() => {});

  await client.close();

  if (screenRes.isError) {
    const err = screenRes.content.find((c) => c.type === "text")?.text ?? "";
    throw new Error(`Screenshot failed: ${err}`);
  }

  const imageContent = screenRes.content.find((c) => c.type === "image");
  if (!imageContent || imageContent.type !== "image") {
    throw new Error("No image in screenshot response");
  }

  const data = imageContent.data;
  if (output) {
    const buf = Buffer.from(data, "base64");
    await Bun.write(output, buf);
    console.error(`Screenshot saved to ${output}`);
  } else {
    process.stdout.write(Buffer.from(data, "base64"));
  }

  return data;
}

async function runEval(url: string, script: string) {
  const client = await createMcpClient();

  const navRes = await client.callTool({
    name: "puppeteer_navigate",
    arguments: { url },
  });
  if (navRes.isError) {
    const err = navRes.content.find((c) => c.type === "text")?.text ?? "";
    throw new Error(`Navigate failed: ${err}`);
  }

  const { sessionId, tabId } = extractNavigateResult(navRes);
  if (!sessionId || !tabId) throw new Error("No sessionId/tabId in navigate response");

  const evalRes = await client.callTool({
    name: "puppeteer_evaluate",
    arguments: { sessionId, tabId, script },
  });

  await client.callTool({
    name: "puppeteer_close",
    arguments: { sessionId },
  }).catch(() => {});

  await client.close();

  if (evalRes.isError) {
    const err = evalRes.content.find((c) => c.type === "text")?.text ?? "";
    throw new Error(`Evaluate failed: ${err}`);
  }

  const parsed = JSON.parse(
    evalRes.content.find((c) => c.type === "text")?.text ?? "{}",
  ) as { result?: unknown };
  return typeof parsed.result === "string"
    ? parsed.result
    : JSON.stringify(parsed.result);
}

function printUsage() {
  console.error(`
Usage:
  bun scripts/cli.ts get-content <url> [--selector <css>]
  bun scripts/cli.ts screenshot <url> [--output file.png] [--selector <css>]
  bun scripts/cli.ts eval <url> <script>

Examples:
  bun scripts/cli.ts get-content https://example.com
  bun scripts/cli.ts get-content https://example.com --selector "#main"
  bun scripts/cli.ts screenshot https://example.com -o out.png
  bun scripts/cli.ts eval https://example.com "return document.title"

Env: MCP_URL (default: http://localhost:8000/mcp)
`);
}

async function main() {
  const { cmd, positional, flags } = parseArgs();

  if (!cmd || cmd === "--help" || cmd === "-h") {
    printUsage();
    process.exit(cmd ? 0 : 1);
  }

  const output = flags.output;

  try {
    if (cmd === "get-content" || cmd === "puppeteer_get_content") {
      const url = positional[0];
      if (!url?.startsWith("http")) {
        console.error("Error: get-content requires a URL");
        printUsage();
        process.exit(1);
      }
      const content = await runGetContent(url, flags.selector);
      console.log(content);
    } else if (cmd === "screenshot" || cmd === "puppeteer_screenshot") {
      const url = positional[0];
      if (!url?.startsWith("http")) {
        console.error("Error: screenshot requires a URL");
        printUsage();
        process.exit(1);
      }
      await runScreenshot(url, output, flags.selector);
    } else if (cmd === "eval") {
      const [url, script] = positional;
      if (!url?.startsWith("http") || !script) {
        console.error("Error: eval requires <url> and <script>");
        printUsage();
        process.exit(1);
      }
      const result = await runEval(url, script);
      console.log(result);
    } else {
      console.error(`Unknown command: ${cmd}`);
      printUsage();
      process.exit(1);
    }
  } catch (err) {
    console.error("Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
