import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ContentApiClient } from '../src/content-api.js'
import { registerAccountTools, whoami } from '../src/tools/account.js'
import { parseToolJson, recordingFetch, toolText, withTools } from './_harness.js'

const BASE = 'https://studio.weaverse.io/api/v1/content'

function accountClient(apiKey: string | null, fetchImpl: typeof fetch) {
  return new ContentApiClient({ apiKey, baseUrl: BASE, fetchImpl })
}

const projectsList = {
  object: 'list',
  data: [{ id: 'p1', name: 'Store', parentProjectId: null, createdAt: null }],
  nextCursor: null,
}

// --- whoami() composition --------------------------------------------------

test('whoami: composes shop id + scopes + projects when identity endpoint responds', async () => {
  const { fetchImpl } = recordingFetch((url) =>
    url.includes('/api/agent/project')
      ? { json: { projectId: 'p1', name: 'Store', weaverseShopId: 'shop_1', scopes: ['project:read'] } }
      : { json: projectsList }
  )

  const id = await whoami(accountClient('key', fetchImpl))

  assert.equal(id.weaverseShopId, 'shop_1')
  assert.deepEqual(id.scopes, ['project:read'])
  assert.equal(id.projects.length, 1)
  assert.equal('note' in id, false)
})

test('whoami: still returns projects + a note when identity endpoint is absent', async () => {
  const { fetchImpl } = recordingFetch((url) =>
    url.includes('/api/agent/project')
      ? { status: 404, json: { object: 'error' } }
      : { json: projectsList }
  )

  const id = await whoami(accountClient('key', fetchImpl))

  assert.equal(id.weaverseShopId, null)
  assert.equal(id.scopes, null)
  assert.equal(id.projects.length, 1)
  assert.ok('note' in id)
})

test('whoami: missing token rejects before reporting identity', async () => {
  const { fetchImpl, calls } = recordingFetch(() => ({ json: {} }))

  await assert.rejects(whoami(accountClient(null, fetchImpl)))
  assert.equal(calls.length, 0)
})

// --- account tools end-to-end (through the MCP tool surface) ----------------

test('list_projects (authed): returns shop-scoped project data', async () => {
  const { fetchImpl } = recordingFetch(() => ({ json: projectsList }))

  await withTools(
    (server) => registerAccountTools(server, accountClient('key', fetchImpl)),
    async (client) => {
      const res = await client.callTool({ name: 'list_projects', arguments: {} })
      assert.notEqual(res.isError, true)
      const data = parseToolJson(res as never) as typeof projectsList
      assert.equal(data.data[0]?.id, 'p1')
    }
  )
})

test('account tool without a token → clear auth error, not data', async () => {
  const { fetchImpl } = recordingFetch(() => ({ json: projectsList }))

  await withTools(
    (server) => registerAccountTools(server, accountClient(null, fetchImpl)),
    async (client) => {
      const res = await client.callTool({ name: 'list_projects', arguments: {} })
      assert.equal(res.isError, true)
      assert.match(toolText(res as never), /Authentication required/i)
    }
  )
})

test('account tool with cross-shop / unscoped token → 403 access-denied error', async () => {
  const { fetchImpl } = recordingFetch(() => ({
    status: 403,
    json: { object: 'error', code: 'FORBIDDEN', message: 'Access denied' },
  }))

  await withTools(
    (server) => registerAccountTools(server, accountClient('key', fetchImpl)),
    async (client) => {
      const res = await client.callTool({
        name: 'get_page',
        arguments: { projectId: 'someone-elses-project', type: 'INDEX', handle: '' },
      })
      assert.equal(res.isError, true)
      assert.match(toolText(res as never), /Access denied/i)
    }
  )
})

test('get_page: defaults to portable-text and returns PT content', async () => {
  const { fetchImpl, calls } = recordingFetch(() => ({
    json: {
      object: 'page',
      id: 'pg1',
      type: 'INDEX',
      handle: '',
      locale: null,
      updatedAt: null,
      content: [{ _type: 'block', children: [{ _type: 'span', text: 'Hi' }] }],
    },
  }))

  await withTools(
    (server) => registerAccountTools(server, accountClient('key', fetchImpl)),
    async (client) => {
      const res = await client.callTool({
        name: 'get_page',
        arguments: { projectId: 'p1', type: 'INDEX', handle: '' },
      })
      assert.notEqual(res.isError, true)
      const page = parseToolJson(res as never) as { object: string; content: unknown[] }
      assert.equal(page.object, 'page')
      assert.ok(Array.isArray(page.content))
      assert.ok(calls.some((c) => c.url.includes('format=portable-text')))
    }
  )
})

test('whoami tool: reports identity over the MCP surface', async () => {
  const { fetchImpl } = recordingFetch((url) =>
    url.includes('/api/agent/project')
      ? { status: 404, json: {} }
      : { json: projectsList }
  )

  await withTools(
    (server) => registerAccountTools(server, accountClient('key', fetchImpl)),
    async (client) => {
      const res = await client.callTool({ name: 'whoami', arguments: {} })
      const id = parseToolJson(res as never) as { object: string; projects: unknown[]; note?: string }
      assert.equal(id.object, 'identity')
      assert.equal(id.projects.length, 1)
      assert.ok(id.note)
    }
  )
})
