import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ContentApiClient } from '../content-api.js'
import { jsonResult, mapApiError } from '../result.js'

// Every account tool is a read-only wrapper over the Content API that reaches an
// external service. `openWorldHint` tells clients the result domain is open.
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const

/**
 * Compose a `whoami` view for the configured token: which shop it belongs to
 * (when discoverable), which scopes it carries (when discoverable), and which
 * projects it can read.
 *
 * `listProjects` doubles as the auth gate — it throws NO_API_KEY/401 when the
 * token is missing or rejected, surfacing a clear error before we report any
 * identity. Shop id + scopes come from the agent-handshake identity endpoint and
 * are `null` until that ships (see ContentApiClient.getIdentity); we attach a
 * `note` in that case rather than fabricating values.
 */
export async function whoami(client: ContentApiClient) {
  const projects = await client.listProjects({ limit: 100 })
  const identity = await client.getIdentity()

  const incompleteIdentity =
    identity === null || identity.weaverseShopId === null || identity.scopes === null

  return {
    object: 'identity' as const,
    weaverseShopId: identity?.weaverseShopId ?? null,
    scopes: identity?.scopes ?? null,
    projects: projects.data,
    ...(incompleteIdentity
      ? {
          note: 'Shop id and scopes are exposed by the agent device-handshake identity endpoint (companion feature) and are null until it ships. The project list above reflects the shop this token is scoped to.',
        }
      : {}),
  }
}

/**
 * Register the authenticated, read-only account tools. They are always
 * registered (so an agent can discover them) but every call requires
 * WEAVERSE_API_KEY with Content API read access; without it the tool returns a
 * clear auth error instead of data. Shop scoping and per-scope access are
 * enforced by the Content API and surfaced here as MCP errors.
 */
export function registerAccountTools(
  server: McpServer,
  client: ContentApiClient
): void {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description:
        "List the Weaverse projects in your shop (id, name, parent, createdAt), cursor-paginated. Requires WEAVERSE_API_KEY with Content API read access. Scoped to the token's shop.",
      inputSchema: {
        after: z
          .string()
          .optional()
          .describe("Pagination cursor from a previous response's nextCursor"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Max projects to return (default 50, max 100)'),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      try {
        return jsonResult(await client.listProjects(args))
      } catch (err) {
        return mapApiError(err)
      }
    }
  )

  server.registerTool(
    'list_pages',
    {
      title: 'List pages',
      description:
        'List the pages (page assignments) in a project: id, type, handle, locale. Filter by type/locale; cursor-paginated. Requires WEAVERSE_API_KEY.',
      inputSchema: {
        projectId: z.string().describe('Project id (from list_projects)'),
        type: z
          .string()
          .optional()
          .describe('Filter by page type, e.g. INDEX, PRODUCT, COLLECTION, CUSTOM'),
        locale: z.string().optional().describe('Filter by locale, e.g. fr-fr'),
        after: z.string().optional().describe('Pagination cursor'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Max pages (default 50, max 100)'),
      },
      annotations: READ_ONLY,
    },
    async ({ projectId, ...rest }) => {
      try {
        return jsonResult(await client.listPages(projectId, rest))
      } catch (err) {
        return mapApiError(err)
      }
    }
  )

  server.registerTool(
    'get_page',
    {
      title: 'Get page content',
      description:
        'Get a single page\'s content. Defaults to Portable Text (structured, LLM-friendly JSON); pass format="weaverse" for the raw Weaverse item tree. Requires WEAVERSE_API_KEY.',
      inputSchema: {
        projectId: z.string().describe('Project id (from list_projects)'),
        type: z.string().describe('Page type, e.g. INDEX, PRODUCT, COLLECTION, CUSTOM'),
        handle: z
          .string()
          .describe(
            'Page handle — use the exact value returned by list_pages (it round-trips). May be empty for singleton types like INDEX, or contain "/" for custom pages (e.g. pages/gift-shop).'
          ),
        format: z
          .enum(['weaverse', 'portable-text'])
          .optional()
          .describe('Output format (default: portable-text)'),
        locale: z.string().optional().describe('Locale, e.g. fr-fr'),
        meta: z
          .boolean()
          .optional()
          .describe('Include _weaverse round-trip ids on Portable Text custom blocks'),
      },
      annotations: READ_ONLY,
    },
    async ({ projectId, type, handle, ...rest }) => {
      try {
        return jsonResult(await client.getPage(projectId, type, handle, rest))
      } catch (err) {
        return mapApiError(err)
      }
    }
  )

  server.registerTool(
    'get_theme_settings',
    {
      title: 'Get theme settings',
      description:
        "Get a project's theme settings (design tokens + configuration). Optionally merge static translations for a locale. Requires WEAVERSE_API_KEY.",
      inputSchema: {
        projectId: z.string().describe('Project id (from list_projects)'),
        format: z
          .enum(['weaverse', 'portable-text'])
          .optional()
          .describe('Output format (default: weaverse)'),
        locale: z
          .string()
          .optional()
          .describe('Locale to resolve static translations for, e.g. fr-fr'),
      },
      annotations: READ_ONLY,
    },
    async ({ projectId, ...rest }) => {
      try {
        return jsonResult(await client.getThemeSettings(projectId, rest))
      } catch (err) {
        return mapApiError(err)
      }
    }
  )

  server.registerTool(
    'list_languages',
    {
      title: 'List languages',
      description:
        'List the locales configured for a project (code, name, isDefault). Requires WEAVERSE_API_KEY.',
      inputSchema: {
        projectId: z.string().describe('Project id (from list_projects)'),
      },
      annotations: READ_ONLY,
    },
    async ({ projectId }) => {
      try {
        return jsonResult(await client.listLanguages(projectId))
      } catch (err) {
        return mapApiError(err)
      }
    }
  )

  server.registerTool(
    'whoami',
    {
      title: 'Who am I',
      description:
        'Identify the configured token: its shop id and scopes (when available) and the projects it can access. Call this first to confirm authentication and discover project ids. Requires WEAVERSE_API_KEY.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async () => {
      try {
        return jsonResult(await whoami(client))
      } catch (err) {
        return mapApiError(err)
      }
    }
  )
}
