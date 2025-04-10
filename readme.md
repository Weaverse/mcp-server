# Weaverse MCP Server

This is the MCP server for Weaverse. It is a simple server that allows you to search the Weaverse documentation.

## Setup

To run the Weaverse MCP server using npx, use the following command:

```bash
npx -y @weaverse/mcp@latest
```


## Usage with Cursor or Claude Desktop 

Add the following configuration. For more information, read the [Cursor MCP documentation](https://docs.cursor.com/context/model-context-protocol) or the [Claude Desktop MCP guide](https://modelcontextprotocol.io/quickstart/user).

```json
{
  "mcpServers": {
    "weaverse-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@weaverse/mcp"
      ]
    }
  }
}
```

## Available tools

This MCP server provides the following tools:

| Tool Name               | Description                                    |
| ----------------------- | ---------------------------------------------- |
| search_weaverse_docs    | Search Weaverse.io documentation               |


## License

ISC