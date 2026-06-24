import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ContentApiClient, WeaverseApiError } from '../src/content-api.js'
import { mapApiError } from '../src/result.js'
import { recordingFetch } from './_harness.js'

const BASE = 'https://studio.weaverse.io/api/v1/content'

function client(apiKey: string | null, fetchImpl: typeof fetch) {
  return new ContentApiClient({ apiKey, baseUrl: BASE, fetchImpl })
}

test('listProjects: forwards bearer token and returns shop-scoped data', async () => {
  const { fetchImpl, calls } = recordingFetch(() => ({
    json: { object: 'list', data: [{ id: 'p1', name: 'Store', parentProjectId: null, createdAt: null }], nextCursor: null },
  }))

  const res = await client('key-123', fetchImpl).listProjects()

  assert.equal(res.data[0]?.id, 'p1')
  assert.equal(calls.length, 1)
  assert.equal(calls[0]?.url, `${BASE}/projects`)
  const headers = calls[0]?.init?.headers as Record<string, string>
  assert.equal(headers.Authorization, 'Bearer key-123')
})

test('missing token: throws NO_API_KEY (401) without calling the network', async () => {
  const { fetchImpl, calls } = recordingFetch(() => ({ json: {} }))

  await assert.rejects(
    client(null, fetchImpl).listProjects(),
    (err: unknown) =>
      err instanceof WeaverseApiError && err.status === 401 && err.code === 'NO_API_KEY'
  )
  assert.equal(calls.length, 0)
})

test('forbidden: cross-shop / missing-scope surfaces as 403 FORBIDDEN', async () => {
  const { fetchImpl } = recordingFetch(() => ({
    status: 403,
    json: { object: 'error', code: 'FORBIDDEN', message: 'Access denied' },
  }))

  await assert.rejects(
    client('key', fetchImpl).getPage('other-shop-project', 'INDEX', ''),
    (err: unknown) =>
      err instanceof WeaverseApiError && err.status === 403 && err.code === 'FORBIDDEN'
  )
})

test('not found: 404 keeps the API error code', async () => {
  const { fetchImpl } = recordingFetch(() => ({
    status: 404,
    json: { object: 'error', code: 'PROJECT_NOT_FOUND', message: 'Project not found' },
  }))

  await assert.rejects(
    client('key', fetchImpl).listLanguages('nope'),
    (err: unknown) =>
      err instanceof WeaverseApiError && err.status === 404 && err.code === 'PROJECT_NOT_FOUND'
  )
})

test('getPage: defaults to portable-text and returns the PT envelope', async () => {
  const { fetchImpl, calls } = recordingFetch(() => ({
    contentType: 'application/portable-text+json; charset=utf-8',
    json: {
      object: 'page',
      id: 'pg1',
      type: 'INDEX',
      handle: '',
      locale: null,
      updatedAt: null,
      content: [{ _type: 'block', children: [{ _type: 'span', text: 'Hello' }] }],
    },
  }))

  const page = await client('key', fetchImpl).getPage('p1', 'INDEX', '')

  assert.ok(calls[0]?.url.includes('format=portable-text'))
  assert.equal(page.object, 'page')
  assert.ok(Array.isArray(page.content))
})

test('getPage: explicit weaverse format is forwarded', async () => {
  const { fetchImpl, calls } = recordingFetch(() => ({ json: { object: 'page', items: [] } }))

  await client('key', fetchImpl).getPage('p1', 'PRODUCT', 'shoe', { format: 'weaverse' })

  assert.ok(calls[0]?.url.includes('format=weaverse'))
  assert.ok(!calls[0]?.url.includes('portable-text'))
})

test('getPage: a handle containing "/" is preserved as a path (segments encoded)', async () => {
  const { fetchImpl, calls } = recordingFetch(() => ({ json: { object: 'page' } }))

  await client('key', fetchImpl).getPage('p1', 'CUSTOM', 'pages/gift shop')

  // Slashes kept so the route splat matches; the space in a segment is encoded.
  assert.ok(calls[0]?.url.includes('/pages/CUSTOM/pages/gift%20shop'))
})

test('network failure: surfaces as a NETWORK_ERROR (status 0)', async () => {
  const fetchImpl = (async () => {
    throw new Error('ECONNREFUSED')
  }) as unknown as typeof fetch

  await assert.rejects(
    client('key', fetchImpl).listProjects(),
    (err: unknown) =>
      err instanceof WeaverseApiError && err.status === 0 && err.code === 'NETWORK_ERROR'
  )
})

test('getIdentity: returns null when the handshake endpoint is absent (404)', async () => {
  const { fetchImpl } = recordingFetch(() => ({ status: 404, json: { object: 'error' } }))

  assert.equal(await client('key', fetchImpl).getIdentity(), null)
})

test('getIdentity: returns shop id + scopes when the endpoint responds', async () => {
  const { fetchImpl, calls } = recordingFetch(() => ({
    json: { projectId: 'p1', name: 'Store', weaverseShopId: 'shop_1', scopes: ['project:read'] },
  }))

  const identity = await client('key', fetchImpl).getIdentity()

  assert.deepEqual(identity, { weaverseShopId: 'shop_1', scopes: ['project:read'] })
  assert.ok(calls[0]?.url.endsWith('/api/agent/project'))
})

test('mapApiError: NO_API_KEY → actionable "authentication required" message', () => {
  const result = mapApiError(new WeaverseApiError(401, 'NO_API_KEY', 'no key'))

  assert.equal(result.isError, true)
  const text = (result.content[0] as { text: string }).text
  assert.match(text, /Authentication required/i)
  assert.match(text, /WEAVERSE_API_KEY/)
})

test('mapApiError: distinguishes 401 invalid, 403 access denied, 404 not found', () => {
  const invalid = (mapApiError(new WeaverseApiError(401, 'UNAUTHORIZED', 'x')).content[0] as { text: string }).text
  const denied = (mapApiError(new WeaverseApiError(403, 'FORBIDDEN', 'x')).content[0] as { text: string }).text
  const missing = (mapApiError(new WeaverseApiError(404, 'PAGE_NOT_FOUND', 'Page not found: INDEX/')).content[0] as { text: string }).text

  assert.match(invalid, /Authentication failed/i)
  assert.match(denied, /Access denied/i)
  assert.match(missing, /Not found/i)
})

test('mapApiError: non-API errors are reported, not swallowed', () => {
  const text = (mapApiError(new Error('boom')).content[0] as { text: string }).text
  assert.match(text, /Unexpected error/i)
  assert.match(text, /boom/)
})
