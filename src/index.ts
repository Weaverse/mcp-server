import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {  weaverseTools } from './tools/index.js';


async function main() {
// Create server instance
  const server = new McpServer({
    name: 'weaverse-mcp',
    version: '1.0.0',
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
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
