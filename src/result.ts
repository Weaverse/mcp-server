import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { WeaverseApiError } from './content-api.js'

/** Wrap a JSON-serialisable payload as a successful MCP text result. */
export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
}

/**
 * Convert a thrown error (usually a {@link WeaverseApiError} from the Content
 * API) into an MCP error result with a clear, actionable message. The Content
 * API is authoritative for auth/scoping, so we translate its HTTP status here
 * rather than guessing client-side.
 */
export function mapApiError(err: unknown): CallToolResult {
  const message = toMessage(err)
  return { isError: true, content: [{ type: 'text', text: message }] }
}

function toMessage(err: unknown): string {
  if (!(err instanceof WeaverseApiError)) {
    const reason = err instanceof Error ? err.message : String(err)
    return `Unexpected error calling the Weaverse API: ${reason}`
  }

  switch (err.code) {
    case 'NO_API_KEY':
      return [
        'Authentication required. This is an account tool — set WEAVERSE_API_KEY',
        'in your MCP server `env` to use it. Get a key from the Weaverse Dashboard',
        '→ Settings → API Keys, or via the agent device handshake.',
        'Documentation tools (search_weaverse_docs) work without a key.',
      ].join(' ')
    case 'NETWORK_ERROR':
      return err.message
    default:
      break
  }

  if (err.status === 401) {
    return `Authentication failed: WEAVERSE_API_KEY is invalid or expired (${err.code}).`
  }
  if (err.status === 403) {
    return `Access denied (${err.code}): this token cannot access that resource. Account tools are scoped to the shop the token belongs to, and to the scopes granted to it.`
  }
  if (err.status === 404) {
    return `Not found: ${err.message}`
  }
  if (err.status === 400) {
    return `Invalid request: ${err.message}`
  }
  return `Weaverse API error (${err.status} ${err.code}): ${err.message}`
}
