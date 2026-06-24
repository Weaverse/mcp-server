#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './config.js'
import { registerAllTools } from './tools/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf8')
) as { version: string }
const VERSION = packageJson.version

async function main() {
  const config = loadConfig()

  const server = new McpServer({
    name: 'weaverse-mcp',
    version: VERSION,
  })

  registerAllTools(server, config, VERSION)

  const transport = new StdioServerTransport()
  await server.connect(transport)

  // Logs go to stderr — stdout is the MCP JSON-RPC channel and must stay clean.
  const accountState = config.apiKey
    ? 'authenticated'
    : 'no WEAVERSE_API_KEY set (docs tools only; set it to enable account tools)'
  console.error(
    `Weaverse MCP server v${VERSION} running on stdio — account tools: ${accountState}`
  )
}

main().catch((error) => {
  console.error('Fatal error in main():', error)
  process.exit(1)
})
