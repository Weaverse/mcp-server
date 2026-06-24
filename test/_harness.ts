import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

/**
 * Spin up an McpServer, let the caller register tools on it, link it to a Client
 * over an in-memory transport, and run `fn` against the connected client. The
 * client is always closed afterwards so the test process doesn't hang on an open
 * transport. This exercises the real registerTool → schema-validation → handler
 * → result path without any network or stdio.
 */
export async function withTools(
  register: (server: McpServer) => void,
  fn: (client: Client) => Promise<void>
): Promise<void> {
  const server = new McpServer({ name: 'test', version: '0.0.0' })
  register(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ])

  try {
    await fn(client)
  } finally {
    await client.close()
  }
}

export interface FakeResponseSpec {
  status?: number
  json?: unknown
  text?: string
  contentType?: string
}

export interface RecordedCall {
  url: string
  init?: RequestInit
}

/**
 * A fake `fetch` that records every call and returns canned responses chosen by
 * `handler` (keyed off the requested URL). Lets ContentApiClient run for real
 * against deterministic HTTP without touching the network.
 */
export function recordingFetch(
  handler: (url: string, init?: RequestInit) => FakeResponseSpec
): { fetchImpl: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const fetchImpl = (async (input: unknown, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : String(input)
    calls.push({ url, init })

    const spec = handler(url, init)
    const headers: Record<string, string> = {}
    if (spec.contentType) {
      headers['content-type'] = spec.contentType
    }
    const body =
      spec.text ?? (spec.json !== undefined ? JSON.stringify(spec.json) : '')
    return new Response(body, { status: spec.status ?? 200, headers })
  }) as unknown as typeof fetch

  return { fetchImpl, calls }
}

/** Parse the JSON a tool returned in its first text content block. */
export function parseToolJson(result: {
  content?: Array<{ type: string; text?: string }>
}): unknown {
  const text = result.content?.find((c) => c.type === 'text')?.text ?? ''
  return JSON.parse(text)
}

/** First text block of a tool result, for substring assertions. */
export function toolText(result: {
  content?: Array<{ type: string; text?: string }>
}): string {
  return result.content?.find((c) => c.type === 'text')?.text ?? ''
}
