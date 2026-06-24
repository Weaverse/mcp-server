// Manual stdio smoke test: spawns the built server and exercises it end-to-end
// over the real MCP stdio transport. The docs tool hits the live Mintlify docs
// MCP, so this needs network. Run after `npm run build`:
//
//   node test.js                       # docs tools only
//   WEAVERSE_API_KEY=... node test.js  # also exercises account tools live
//
// This is a developer smoke, not part of `npm test` (which is offline + deterministic).

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['build/index.js'],
    env: process.env,
  })
  const client = new Client({ name: 'smoke-test', version: '1.0.0' })

  await client.connect(transport)
  console.log('🔌 connected\n')

  const { tools } = await client.listTools()
  console.log('🔧 tools:', tools.map((t) => t.name).join(', '), '\n')

  console.log('🔎 search_weaverse_docs (live Mintlify):')
  const docs = await client.callTool({
    name: 'search_weaverse_docs',
    arguments: { prompt: 'create a custom section with schema' },
  })
  console.log('   isError:', docs.isError === true)
  console.log('   first hit:\n', (docs.content?.[0]?.text || '').slice(0, 300), '\n')

  console.log('🪪 whoami:')
  const who = await client.callTool({ name: 'whoami', arguments: {} })
  console.log('   isError:', who.isError === true)
  console.log('   text:', (who.content?.[0]?.text || '').slice(0, 200), '\n')

  await client.close()
  console.log('✅ smoke complete')
}

main().catch((error) => {
  console.error('❌ smoke failed:', error)
  process.exit(1)
})
