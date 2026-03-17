import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export default (server: McpServer) => {
  server.registerTool(
    "greet",
    {
      description: "Greet someone by name",
      inputSchema: z.object({
        name: z.string().describe("Name to greet"),
      }),
    },
    async ({ name }) => ({
      content: [
        {
          type: "text" as const,
          text: `Hello, ${name}! I'm your local MCP tool.`,
        },
      ],
    })
  );
}
