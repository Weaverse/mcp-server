import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { WeaverseMcpConfig } from '../config.js'
import { ContentApiClient } from '../content-api.js'
import { registerAccountTools } from './account.js'
import { MintlifyDocsSearcher, registerDocsTools } from './docs.js'

/**
 * Register every tool on the server.
 *
 * Two groups:
 *  - Docs (public): proxied to the official Mintlify-hosted Weaverse docs MCP.
 *    Always available, no API key.
 *  - Account (authenticated, read-only): always registered for discoverability,
 *    but each call requires WEAVERSE_API_KEY and is enforced/scoped by the
 *    Content API.
 *
 * Group 3 (content writes) is intentionally omitted: the Content API is
 * read-only today. See readme.md for the planned, safety-gated write surface.
 */
export function registerAllTools(
  server: McpServer,
  config: WeaverseMcpConfig,
  version: string
): void {
  registerDocsTools(
    server,
    new MintlifyDocsSearcher({
      url: config.docsMcpUrl,
      toolName: config.docsSearchTool,
      clientVersion: version,
    })
  )

  registerAccountTools(
    server,
    new ContentApiClient({
      apiKey: config.apiKey,
      baseUrl: config.contentApiUrl,
    })
  )
}
