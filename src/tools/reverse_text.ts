import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export default (server: McpServer) => {
  server.registerTool(
    "reverse_text",
    {
      description: "Reverse a string",
      inputSchema: z.object({
        text: z.string().describe("Text to reverse"),
      }),
    },
    async ({ text }) => ({
      content: [
        {
          type: "text" as const,
          text: text.split("").reverse().join(""),
        },
      ],
    })
  );
}
