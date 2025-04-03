#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {  weaverseTools } from './tools/index.js';
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, "../package.json"), "utf8")
);
const VERSION = packageJson.version;

async function main() {
// Create server instance
  const server = new McpServer({
    name: 'weaverse-mcp',
    version: VERSION,
    capabilities: {
      resources: {},
      tools: {},
    },
  });
  // Add tools
  weaverseTools(server);
  // Connect to server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Weaverse MCP server v${VERSION} is running on stdio`);
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
