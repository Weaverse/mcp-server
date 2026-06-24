/**
 * Runtime configuration for the Weaverse MCP server, resolved from environment
 * variables.
 *
 * The server is distributed as `npx @weaverse/mcp` and launched over stdio by an
 * MCP client (Cursor, Claude, Codex, …). The client supplies configuration via
 * the `env` block of its MCP server definition, e.g.:
 *
 *   {
 *     "mcpServers": {
 *       "weaverse": {
 *         "command": "npx",
 *         "args": ["-y", "@weaverse/mcp"],
 *         "env": { "WEAVERSE_API_KEY": "..." }
 *       }
 *     }
 *   }
 */

export interface WeaverseMcpConfig {
  /**
   * Bearer token for the authenticated account tools. Forwarded verbatim to the
   * Content API as `Authorization: Bearer <apiKey>`; `null` when unset.
   *
   * The MCP server never inspects or validates this token — the Content API is
   * the single source of truth for shop scoping and per-scope access (this is
   * how we avoid building auth twice). Today the Content API accepts a Content
   * API key (Dashboard → Settings → API Keys). Once the agent device handshake
   * ships (companion issue), the same field carries a scoped `agent_cli` token.
   *
   * Docs tools never read this; they are public.
   */
  apiKey: string | null

  /** Content API base URL, no trailing slash. */
  contentApiUrl: string

  /**
   * The Mintlify-hosted docs MCP endpoint that backs the docs search tool
   * (Streamable HTTP, public). The docs tool proxies to this server's
   * `search_weaverse` tool.
   */
  docsMcpUrl: string

  /** Tool name to call on the upstream Mintlify docs MCP. */
  docsSearchTool: string
}

export const DEFAULT_CONTENT_API_URL = 'https://studio.weaverse.io/api/v1/content'
// The Mintlify docs MCP. Use the resolved origin (weaverse.io/docs/mcp) rather
// than the docs.weaverse.io alias: the alias 301-redirects, and `fetch` downgrades
// a redirected POST to GET, which would break the JSON-RPC call.
export const DEFAULT_DOCS_MCP_URL = 'https://weaverse.io/docs/mcp'
export const DEFAULT_DOCS_SEARCH_TOOL = 'search_weaverse'

// Trim and treat blank values as unset, so an empty `"WEAVERSE_API_KEY": ""` in
// an MCP config block is the same as omitting it (docs tools keep working).
function readEnv(env: NodeJS.ProcessEnv, name: string): string | null {
  const raw = env[name]
  if (raw == null) {
    return null
  }
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WeaverseMcpConfig {
  const contentApiUrl =
    readEnv(env, 'WEAVERSE_CONTENT_API_URL') ?? DEFAULT_CONTENT_API_URL

  return {
    apiKey: readEnv(env, 'WEAVERSE_API_KEY'),
    contentApiUrl: contentApiUrl.endsWith('/')
      ? contentApiUrl.slice(0, -1)
      : contentApiUrl,
    docsMcpUrl: readEnv(env, 'WEAVERSE_DOCS_MCP_URL') ?? DEFAULT_DOCS_MCP_URL,
    docsSearchTool: readEnv(env, 'WEAVERSE_DOCS_SEARCH_TOOL') ?? DEFAULT_DOCS_SEARCH_TOOL,
  }
}
