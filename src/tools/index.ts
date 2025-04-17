import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
const endpoint = "https://weaverse.io/api/public/rag";


export async function queryRag(prompt: string) {
  try {
    // call weaverse api to search docs
    const response = await fetch(
      `${endpoint}?query=${encodeURIComponent(prompt)}`,
    )

    const res = await response.json()
    if (res.success) {
      try {
        const { data } = res.result
        // Format the data to include source, title and content
        const formattedResults = data.map((item: any) => {
          try {
            // Extract title from content if available
            const titleMatch = item.content[0]?.text.match(/Title: (.*?)\n/)
            const title = (titleMatch ? titleMatch[1] : item.filename) || ''

            // Extract URL if available
            const urlMatch = item.content[0]?.text.match(/URL: (.*?)\n/)
            const source =
              (urlMatch ? urlMatch[1] : `File: ${item.filename}`) || ''

            // Combine all content pieces and ensure it's properly escaped
            const content =
              item.content
                ?.map((c: any) =>
                  (c?.text || '')
                    .replace(/\u2028/g, '\\u2028')
                    .replace(/\u2029/g, '\\u2029'),
                )
                .filter(Boolean)
                .join('\n') || ''

            // Ensure all fields are strings or numbers to avoid JSON issues
            return {
              title: String(title),
              source: String(source),
              content: String(content),
              score: Number(item.score) || 0,
            }
          } catch (itemError) {
            // Return a fallback object for this item
            return {
              title: 'Unknown Title',
              source: 'Unknown Source',
              content: '',
              score: 0,
            }
          }
        })

        // Ensure the array is not empty
        if (!Array.isArray(formattedResults) || formattedResults.length === 0) {
          return {
            success: false,
            formattedText: 'No results found',
          }
        }

        return {
          success: true,
          formattedText: JSON.stringify(formattedResults, null, 2),
        }
      } catch (formatError) {
        return {
          success: false,
          formattedText: 'Error formatting search results',
        }
      }
    }
    return {
      success: false,
      formattedText: 'No results found',
    }
  } catch (error) {
    return {
      success: false,
      formattedText: 'No results found',
    }
  }
}

export function weaverseTools(server: McpServer) {
	server.tool(
  'search_weaverse_docs',
  `This tool will take in the user prompt, search docs and return relevant documentation that will help answer the user's question.`,
  {
    prompt: z.string().describe('The search query for Weaverse documentation'),
  },
  async ({ prompt }) => {
    const result = await queryRag(prompt)
    return {
      content: [
        {
          type: 'text',
          text: result.formattedText || 'No results found',
        },
      ],
    }
  },
)
}
