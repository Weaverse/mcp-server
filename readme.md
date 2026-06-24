# Weaverse MCP Server

`@weaverse/mcp` is the official [Model Context Protocol](https://modelcontextprotocol.io)
server for Weaverse. It gives an AI coding agent two things:

1. **Docs** — search the Weaverse documentation/knowledge base (public, no key).
2. **Your account** — read your own Weaverse projects, pages, theme settings, and
   locales over the [Content API](https://weaverse.io/docs/content-api/overview)
   (authenticated, read-only, scoped to your shop).

It runs locally over **stdio** and is distributed via `npx`, so the same binary
works in Cursor, Claude, Codex, and any other MCP client.

## Quick start

Docs-only (no account, no key required):

```json
{
  "mcpServers": {
    "weaverse": {
      "command": "npx",
      "args": ["-y", "@weaverse/mcp"]
    }
  }
}
```

With your account (adds the authenticated tools):

```json
{
  "mcpServers": {
    "weaverse": {
      "command": "npx",
      "args": ["-y", "@weaverse/mcp"],
      "env": {
        "WEAVERSE_API_KEY": "your-key"
      }
    }
  }
}
```

## Tools

### Docs (public — no API key)

| Tool | Description |
| ---- | ----------- |
| `search_weaverse_docs` | Search the Weaverse docs/knowledge base. Returns titles, links, and content. |
| `search_docs` | Alias of `search_weaverse_docs`. |

Docs search proxies to the official Weaverse documentation MCP (hosted by
Mintlify). Knowledge, ranking, and freshness all live upstream — this server
never caches or reimplements docs search.

### Account (authenticated, read-only)

All require `WEAVERSE_API_KEY`. Each call is scoped to the shop the key belongs
to; cross-shop access returns an error.

| Tool | Description |
| ---- | ----------- |
| `whoami` | Identify the token: shop id + scopes (when available) and the projects it can access. Call this first. |
| `list_projects` | List the projects in your shop (cursor-paginated). |
| `list_pages` | List pages in a project (filter by `type` / `locale`). |
| `get_page` | Get a page's content. **Defaults to Portable Text** (LLM-friendly); pass `format: "weaverse"` for the raw item tree. |
| `get_theme_settings` | Get a project's theme settings (design tokens + config). |
| `list_languages` | List a project's locales. |

### Writes — not yet

The Content API is **read-only today**, so no write tools are exposed. When the
write endpoints land, the planned tools (`update_page_content`,
`update_theme_settings`, …) will ship behind a **dry-run → `confirm: true`**
flow that returns a diff first and writes an audit-log entry on apply.

**Destructive / account-level operations are intentionally never exposed via
MCP** — deleting projects, billing, team/members, plan changes, and production
publishes stay human-only in [Weaverse Builder](https://studio.weaverse.io). An
agent may *propose*; a human *confirms*.

## Authentication

The server reads `WEAVERSE_API_KEY` from its environment and forwards it to the
Content API as `Authorization: Bearer <key>`. It never inspects or stores the
token — the Content API is the single source of truth for shop scoping and
per-scope access. Account tools return a clear auth error (never data) when the
key is missing, invalid, or lacks the required scope.

### Getting a key

- **Today:** a Content API key from **[Weaverse Dashboard → Settings →
  API Keys](https://studio.weaverse.io)**.
- **Coming:** a scoped, expiring `agent_cli` token from the agent **device
  handshake** — your agent runs the handshake once, you approve it in Builder,
  and the agent stores the key. Tokens are revocable any time from
  **Settings → Connected agents**.

### Scopes

Account tools map to Content API scopes (`content:read` for the read tools).
Scope and shop enforcement happen server-side; the MCP surfaces a `403`-style
error when a token is missing a scope or reaches across shops.

## Configuration

| Env var | Default | Purpose |
| ------- | ------- | ------- |
| `WEAVERSE_API_KEY` | — | Bearer token for account tools. Unset = docs-only. |
| `WEAVERSE_CONTENT_API_URL` | `https://studio.weaverse.io/api/v1/content` | Content API base URL. |
| `WEAVERSE_DOCS_MCP_URL` | `https://weaverse.io/docs/mcp` | Upstream Mintlify docs MCP. |
| `WEAVERSE_DOCS_SEARCH_TOOL` | `search_weaverse` | Tool name to call on the docs MCP. |

## `@weaverse/mcp` vs `docs.weaverse.io/mcp`

`https://docs.weaverse.io/mcp` is the Mintlify-hosted, **docs-only** MCP (great
if all you want is documentation search over HTTP, no install). `@weaverse/mcp`
is the **canonical** server: it proxies that same docs search **and** adds the
authenticated account tools. Use `@weaverse/mcp` when you want your agent to work
with your projects, not just read docs.

## Development

```bash
npm install
npm run build     # tsc -> build/
npm test          # offline, deterministic unit tests (node:test)
node test.js      # live stdio smoke (hits the docs MCP; set WEAVERSE_API_KEY for account tools)
```

Source layout:

```
src/
  index.ts            # stdio entry
  config.ts           # env -> config
  content-api.ts      # typed Content API client (forwards the bearer token)
  result.ts           # MCP result + error-mapping helpers
  tools/
    docs.ts           # docs search (proxies the Mintlify docs MCP)
    account.ts        # read-only account tools
    index.ts          # registers all tools
```

## License

ISC
