/**
 * Typed client for the Weaverse Content API
 * (https://studio.weaverse.io/api/v1/content).
 *
 * The MCP server is a thin front-end over this HTTP API. It forwards the
 * configured bearer token verbatim and lets the Content API enforce auth, shop
 * scoping, and per-scope access — the server never validates tokens itself
 * (we do not build auth twice). HTTP failures are normalised into
 * {@link WeaverseApiError} so the tool layer can render a single, clear MCP
 * error message.
 */

/** Normalised Content API failure. `code` mirrors the API's error envelope. */
export class WeaverseApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'WeaverseApiError'
  }
}

export interface ContentApiClientOptions {
  /** Bearer token; `null` means account tools fail with a NO_API_KEY error. */
  apiKey: string | null
  /** Content API base URL, no trailing slash. */
  baseUrl: string
  /** Injectable fetch (tests pass a fake); defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

type QueryValue = string | number | boolean | null | undefined
type Query = Record<string, QueryValue>

export type ContentFormat = 'weaverse' | 'portable-text'

export interface ListResponse<T> {
  object: 'list'
  data: T[]
  nextCursor?: string | null
}

export interface ProjectSummary {
  id: string
  name: string | null
  parentProjectId: string | null
  createdAt: string | null
}

export interface PageSummary {
  id: string
  type: string
  handle: string
  locale: string | null
  pageId: string | null
}

export interface PageDetail {
  object: 'page'
  id: string | null
  type: string
  handle: string
  locale: string | null
  updatedAt: string | null
  meta?: unknown
  seo?: unknown
  /** Present for the `weaverse` format. */
  items?: unknown[]
  /** Present for the `portable-text` format. */
  content?: unknown[]
}

export interface ThemeSettings {
  object: 'theme_settings'
  projectId: string
  theme: Record<string, unknown>
  staticTranslations?: Record<string, unknown>
}

export interface LanguageSummary {
  code: string
  name: string | null
  isDefault: boolean
}

/**
 * Best-effort identity for the configured token. Surfaced by `whoami`.
 *
 * NOTE: this is read from the agent device-handshake endpoint
 * (`GET /api/agent/project`, companion issue `agent-auth-handshake`). Until that
 * ships, the call 404s and `getIdentity()` returns `null` — `whoami` still works
 * from the project list. `scopes` stays `null` until an endpoint exposes them;
 * we do NOT invent a parallel auth surface to synthesise them.
 */
export interface AgentIdentity {
  weaverseShopId: string | null
  scopes: string[] | null
}

function httpStatusToCode(status: number): string {
  switch (status) {
    case 400:
      return 'INVALID_PARAMS'
    case 401:
      return 'UNAUTHORIZED'
    case 403:
      return 'FORBIDDEN'
    case 404:
      return 'NOT_FOUND'
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR'
  }
}

export class ContentApiClient {
  private readonly apiKey: string | null
  private readonly baseUrl: string
  private readonly origin: string
  private readonly fetchImpl: typeof fetch

  constructor(options: ContentApiClientOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl.endsWith('/')
      ? options.baseUrl.slice(0, -1)
      : options.baseUrl
    this.origin = new URL(this.baseUrl).origin
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  listProjects(args: { after?: string; limit?: number } = {}) {
    return this.get<ListResponse<ProjectSummary>>('/projects', {
      after: args.after,
      limit: args.limit,
    })
  }

  listPages(
    projectId: string,
    args: { type?: string; locale?: string; after?: string; limit?: number } = {}
  ) {
    return this.get<ListResponse<PageSummary>>(
      `/projects/${encodeURIComponent(projectId)}/pages`,
      { type: args.type, locale: args.locale, after: args.after, limit: args.limit }
    )
  }

  getPage(
    projectId: string,
    type: string,
    handle: string,
    args: { format?: ContentFormat; locale?: string; meta?: boolean } = {}
  ) {
    // The route captures the handle as a path splat (`pages/:type/*`), so custom
    // handles can contain "/" (e.g. "pages/gift-shop"). Encode each segment but
    // keep the separators so the splat still matches.
    const encodedHandle = handle.split('/').map(encodeURIComponent).join('/')
    return this.get<PageDetail>(
      `/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(type)}/${encodedHandle}`,
      // Default to Portable Text: structured JSON is far easier for an LLM to
      // reason over than the raw Weaverse item tree.
      { format: args.format ?? 'portable-text', locale: args.locale, meta: args.meta }
    )
  }

  getThemeSettings(
    projectId: string,
    args: { format?: ContentFormat; locale?: string } = {}
  ) {
    return this.get<ThemeSettings>(
      `/projects/${encodeURIComponent(projectId)}/theme-settings`,
      { format: args.format, locale: args.locale }
    )
  }

  listLanguages(projectId: string) {
    return this.get<ListResponse<LanguageSummary>>(
      `/projects/${encodeURIComponent(projectId)}/languages`
    )
  }

  /**
   * Best-effort identity lookup against the agent-handshake endpoint. Never
   * throws — returns `null` when the endpoint is absent (handshake unmerged) or
   * the token is rejected, so `whoami` can still report the accessible projects.
   */
  async getIdentity(): Promise<AgentIdentity | null> {
    if (this.apiKey === null) {
      return null
    }
    try {
      const res = await this.fetchImpl(`${this.origin}/api/agent/project`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json' },
      })
      if (!res.ok) {
        return null
      }
      const body = (await res.json().catch(() => null)) as
        | { weaverseShopId?: unknown; scopes?: unknown }
        | null
      if (!body) {
        return null
      }
      return {
        weaverseShopId:
          typeof body.weaverseShopId === 'string' ? body.weaverseShopId : null,
        scopes: Array.isArray(body.scopes)
          ? body.scopes.filter((s): s is string => typeof s === 'string')
          : null,
      }
    } catch {
      return null
    }
  }

  private buildUrl(path: string, query?: Query): string {
    const url = new URL(`${this.baseUrl}${path}`)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value))
        }
      }
    }
    return url.toString()
  }

  private async get<T>(path: string, query?: Query): Promise<T> {
    if (this.apiKey === null) {
      throw new WeaverseApiError(
        401,
        'NO_API_KEY',
        'No WEAVERSE_API_KEY configured for this MCP server.'
      )
    }

    let res: Response
    try {
      res = await this.fetchImpl(this.buildUrl(path, query), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: 'application/json',
        },
      })
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      throw new WeaverseApiError(
        0,
        'NETWORK_ERROR',
        `Could not reach the Weaverse Content API: ${reason}`
      )
    }

    const text = await res.text()
    let body: { code?: unknown; message?: unknown } | undefined
    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = undefined
      }
    }

    if (!res.ok) {
      const code =
        typeof body?.code === 'string' ? body.code : httpStatusToCode(res.status)
      const message =
        typeof body?.message === 'string'
          ? body.message
          : `Request failed with status ${res.status}`
      throw new WeaverseApiError(res.status, code, message)
    }

    return body as T
  }
}
