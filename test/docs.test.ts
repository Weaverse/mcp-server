import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { DocsSearcher } from '../src/tools/docs.js'
import { registerDocsTools } from '../src/tools/docs.js'
import { toolText, withTools } from './_harness.js'

function fakeSearcher(
  impl: (query: string) => Promise<CallToolResult>
): DocsSearcher {
  return { search: impl }
}

test('docs search works with no API key (public) and returns upstream content', async () => {
  const searcher = fakeSearcher(async (query) => ({
    content: [{ type: 'text', text: `Title: Sections\nLink: https://weaverse.io/docs/x\nQuery: ${query}` }],
  }))

  await withTools(
    (server) => registerDocsTools(server, searcher),
    async (client) => {
      const res = await client.callTool({
        name: 'search_weaverse_docs',
        arguments: { prompt: 'custom section' },
      })
      assert.notEqual(res.isError, true)
      assert.match(toolText(res as never), /Title: Sections/)
      assert.match(toolText(res as never), /Query: custom section/)
    }
  )
})

test('both search_weaverse_docs and the search_docs alias are registered', async () => {
  const searcher = fakeSearcher(async () => ({
    content: [{ type: 'text', text: 'hi' }],
  }))

  await withTools(
    (server) => registerDocsTools(server, searcher),
    async (client) => {
      const { tools } = await client.listTools()
      const names = tools.map((t) => t.name)
      assert.ok(names.includes('search_weaverse_docs'))
      assert.ok(names.includes('search_docs'))

      const res = await client.callTool({ name: 'search_docs', arguments: { prompt: 'x' } })
      assert.equal(toolText(res as never), 'hi')
    }
  )
})

test('empty upstream results → "No results found"', async () => {
  const searcher = fakeSearcher(async () => ({ content: [] }))

  await withTools(
    (server) => registerDocsTools(server, searcher),
    async (client) => {
      const res = await client.callTool({ name: 'search_docs', arguments: { prompt: 'zzz' } })
      assert.notEqual(res.isError, true)
      assert.equal(toolText(res as never), 'No results found')
    }
  )
})

test('upstream failure → isError result with the reason', async () => {
  const searcher = fakeSearcher(async () => {
    throw new Error('upstream down')
  })

  await withTools(
    (server) => registerDocsTools(server, searcher),
    async (client) => {
      const res = await client.callTool({ name: 'search_weaverse_docs', arguments: { prompt: 'x' } })
      assert.equal(res.isError, true)
      assert.match(toolText(res as never), /docs search failed/i)
      assert.match(toolText(res as never), /upstream down/)
    }
  )
})
