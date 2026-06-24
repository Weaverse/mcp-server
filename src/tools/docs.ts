import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

/**
 * Minimal seam over "search the docs", so the registered tool can be unit-tested
 * with a fake and run for real against the upstream Mintlify MCP.
 */
export interface DocsSearcher {
  search(query: string): Promise<CallToolResult>
}

export interface MintlifyDocsSearcherOptions {
  /** Upstream Mintlify docs MCP endpoint (Streamable HTTP). */
  url: string
  /** Tool name to call on the upstream server. */
  toolName: string
  /** Reported to the upstream as the MCP client version. */
  clientVersion: string
}

/**
 * Proxies docs search to the official Weaverse documentation MCP, which is
 * hosted by Mintlify (Streamable HTTP transport, public/unauthenticated).
 *
 * We connect to it as a normal MCP client and forward the query — the docs
 * knowledge base, ranking, and freshness all live upstream, so this server
 * never caches or reimplements docs search. One client is created lazily on the
 * first search and reused for the life of the process; a failed connect is not
 * cached, so a later call can retry.
 */
export class MintlifyDocsSearcher implements DocsSearcher {
  private connecting: Promise<Client> | undefined

  constructor(private readonly options: MintlifyDocsSearcherOptions) {}

  async search(query: string): Promise<CallToolResult> {
    const client = await this.getClient()
    const result = await client.callTool({
      name: this.options.toolName,
      arguments: { query },
    })
    return result as CallToolResult
  }

  private getClient(): Promise<Client> {
    if (!this.connecting) {
      this.connecting = this.openClient().catch((err) => {
        this.connecting = undefined
        throw err
      })
    }
    return this.connecting
  }

  private async openClient(): Promise<Client> {
    const client = new Client({
      name: 'weaverse-mcp-docs-proxy',
      version: this.options.clientVersion,
    })
    await client.connect(new StreamableHTTPClientTransport(new URL(this.options.url)))
    return client
  }
}

const DESCRIPTION =
  'Search the official Weaverse documentation and knowledge base. Returns relevant docs (titles, direct links, and content) to answer questions about Weaverse, Pilot themes, the Hydrogen SDK, custom sections/schemas, theme settings, and the visual builder. Public — no API key required.'

/**
 * Register the public docs search tool. Exposed under its canonical v2 name
 * (`search_docs`) and its long-standing name (`search_weaverse_docs`, kept as an
 * alias so existing installs/prompts keep working).
 */
export function registerDocsTools(server: McpServer, searcher: DocsSearcher): void {
  const handler = async ({ prompt }: { prompt: string }): Promise<CallToolResult> => {
    try {
      const result = await searcher.search(prompt)
      const content = Array.isArray(result?.content) ? result.content : []
      if (content.length === 0) {
        return { content: [{ type: 'text', text: 'No results found' }] }
      }
      return result.isError ? { content, isError: true } : { content }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      return {
        isError: true,
        content: [{ type: 'text', text: `Weaverse docs search failed: ${reason}` }],
      }
    }
  }

  const config = {
    title: 'Search Weaverse docs',
    description: DESCRIPTION,
    inputSchema: {
      prompt: z.string().describe('The search query for Weaverse documentation'),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  }

  server.registerTool('search_weaverse_docs', config, handler)
  server.registerTool('search_docs', config, handler)
}
