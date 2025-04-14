import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
const endpoint = "https://weaverse.io/api/public/rag"

export async function queryRag(prompt: string) {
  try {
    // call weaverse api to search docs
    const response = await fetch(
      `${endpoint}?query=${prompt}`
    );
    const res = await response.json();
    if (res.success) {
      const {data} = res.result
      return {
        success: true,
        formattedText: JSON.stringify(data),
      };
    }
    return {
      success: false,
      formattedText: 'No results found',
    };
  } catch (error) {
    return {
      success: false,
      formattedText: 'No results found',
    };
  }
}

export function weaverseTools(server: McpServer) {
  server.tool(
    'search_weaverse_docs',
    `This tool will take in the user prompt, search docs and return relevant documentation that will help answer the user's question.`,
    {
      prompt: z
        .string()
        .describe('The search query for Weaverse documentation'),
    },
    async ({ prompt }) => {
      const result = await queryRag(prompt);
      return {
        content: [
          {
            type: 'text',
            text: result.formattedText,
          },
        ],
      };
    }
  );
}
