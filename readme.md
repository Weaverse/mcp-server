# Weaverse MCP Server

This is the MCP server for Weaverse. It is a simple server that allows you to search the Weaverse documentation.

## Setup

To run the Weaverse MCP server using npx, use the following command:

```bash
npx -y @weaverse/weaverse-mcp@latest
```


## Usage - Local configuration


- Clone this repository
- Build the project

```bash
npm run build
```

- For macOS, run command to copy the current directory path

```bash
pwd | pbcopy
```

Add the following configuration. For more information, read the [Cursor MCP documentation](https://docs.cursor.com/context/model-context-protocol) or the [Claude Desktop MCP guide](https://modelcontextprotocol.io/quickstart/user).

```json
{
  "mcpServers": {
    "weaverse-mcp": {
      "command": "node",
      "args": [
        "<YOUR_LOCAL_PATH>/build/index.js"
      ]
    }
  }
}
```

## Available tools

This MCP server provides the following tools:

| Tool Name               | Description                                    |
| ----------------------- | ---------------------------------------------- |
| search_docs             | Search Weaverse.io documentation               |