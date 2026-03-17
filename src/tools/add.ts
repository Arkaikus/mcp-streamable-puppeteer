import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export default (server: McpServer) => {
  server.registerTool(
    "add",
    {
      description: "Add two numbers",
      inputSchema: z.object({
        a: z.number().describe("First number"),
        b: z.number().describe("Second number"),
      }),
    },
    async ({ a, b }) => ({
      content: [{ type: "text" as const, text: String(a + b) }],
    })
  );
}
