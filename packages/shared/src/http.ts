export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: string,
    public readonly url: string
  ) {
    super(`HTTP ${status} ${statusText} — ${url}\n${body}`);
    this.name = "HttpError";
  }
}

export interface HttpClient {
  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
  getRaw(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<Response>;
}

/**
 * Creates a typed HTTP client bound to a base URL and default headers.
 * All requests log to stderr for observability in VS Code output panel.
 * Non-2xx responses throw HttpError with status + body so callers get a
 * useful error message to return to the LLM.
 */
export function createHttpClient(baseUrl: string, defaultHeaders: Record<string, string>): HttpClient {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path.startsWith("http") ? path : `${base}${path.startsWith("/") ? path : `/${path}`}`);
    if (params) {
      for (const [key, val] of Object.entries(params)) {
        if (val !== undefined && val !== null) {
          url.searchParams.set(key, String(val));
        }
      }
    }
    return url.toString();
  }

  async function request<T>(method: string, path: string, body?: unknown, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = buildUrl(path, params);
    console.error(`[http] ${method} ${url}`);
    const res = await fetch(url, {
      method,
      headers: { ...defaultHeaders, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[http] ERROR ${res.status} ${res.statusText} — ${url}`);
      throw new HttpError(res.status, res.statusText, text, url);
    }
    console.error(`[http] OK ${res.status} — ${url}`);
    return res.json() as Promise<T>;
  }

  return {
    get: (path, params) => request("GET", path, undefined, params),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    delete: (path) => request("DELETE", path),
    getRaw: (path, params) => {
      const url = buildUrl(path, params);
      console.error(`[http] GET (raw) ${url}`);
      return fetch(url, { headers: defaultHeaders });
    },
  };
}
