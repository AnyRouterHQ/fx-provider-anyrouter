import type {
  FxApiKeyCredentials,
  FxCustomProvider,
  FxCustomProviderDefinition,
  FxCustomProviderModel,
} from "libfx";
import {
  ANYROUTER_BASE_URL,
  ANYROUTER_MODELS_URL,
  ANYROUTER_PROVIDER_NAME,
  mapCatalogModels,
  type AnyRouterModelsResponse,
} from "./mapping.js";
import snapshot from "./models.snapshot.json" with { type: "json" };

type Snapshot = { models?: Record<string, unknown>; data?: unknown[] };
const snap = snapshot as unknown as Snapshot;

/** The bundled model-metadata snapshot, mapped from the last live catalog fetch. */
export function bundledModels(): FxCustomProviderDefinition["models"] {
  if (snap.models && typeof snap.models === "object") {
    return snap.models as FxCustomProviderDefinition["models"];
  }
  if (Array.isArray(snap.data)) {
    return mapCatalogModels({ data: snap.data as never[] });
  }
  return {};
}

export interface AnyRouterOptions {
  /** Override the API base URL (e.g. a self-hosted relay). Defaults to
   * `https://anyrouter.dev/api/v1` (fx will call `${baseUrl}/chat/completions`).
   * The provider `name` stays `anyrouter` unless you also set `name`. */
  baseUrl?: string;
  /** Provider name passed to fx `credentials()`. Must match fx's rule:
   * a letter, then letters/digits/`_`/`-`, at most 64 chars, not `gateway`/`codex`/`grok`.
   * Defaults to `anyrouter`. */
  name?: string;
  /** Replace the built-in model snapshot with a pre-mapped `models` record.
   * When given, `anyrouter()` uses it verbatim (and `fetchAnyRouterModels()`
   * is not needed). */
  models?: FxCustomProviderDefinition["models"];
}

/** fx custom-provider object for AnyRouter. Usage:
 * `createFxAgent({ provider: anyrouter(), model: "anyrouter/hermes", credentials })`
 * `credentials` is the helper returned by `anyrouterCredentials()`.
 */
export function anyrouter(opts: AnyRouterOptions = {}): FxCustomProviderDefinition {
  const name = opts.name ?? ANYROUTER_PROVIDER_NAME;
  const baseUrl = opts.baseUrl ?? ANYROUTER_BASE_URL;
  const models = (opts.models ?? bundledModels()) as Record<string, { contextWindow?: number; maxOutputTokens?: number; supportsToolUse?: boolean; supportsVision?: boolean }>;
  return {
    name,
    baseUrl,
    models,
  } satisfies FxCustomProviderDefinition;
}

/** Shape `createFxAgent` expects for a custom provider: the definition under
 * `provider`, plus the `credentials` callback. `credentials` reads the key
 * from `ANYROUTER_API_KEY` at call time (per fx's contract, which calls it
 * with `{ provider, sessionId }` in whichever process runs the turn).
 */
export function anyrouterAgent(opts: AnyRouterOptions = {}): FxCustomProvider {
  const definition = anyrouter(opts);
  return {
    provider: definition,
    credentials: anyrouterCredentials(),
  } satisfies FxCustomProvider;
}

/** fx `credentials()` callback that supplies the provider API key. Reads
 * `ANYROUTER_API_KEY` on each call so test injection (`process.env`) and
 * secrets rotation both work. Never logs or caches the key.
 */
export function anyrouterCredentials(): (
  request: { provider: string; sessionId?: string },
) => Promise<FxApiKeyCredentials> {
  return async ({ provider }: { provider: string; sessionId?: string }) => {
    const apiKey = process.env.ANYROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        `ANYROUTER_API_KEY is not set (provider "${provider}"). Get a key at https://anyrouter.dev and export it.`,
      );
    }
    return { apiKey };
  };
}

/** Convenience alias matching the fx docs' naming style: the credentials
 * callback itself. `anyrouterCredentials()` returns a function; this export is
 * the same factory so `credentials: anyrouterCredentials()` matches `credentials` usage.
 */
export const credentials = anyrouterCredentials;

/** Fetch the live AnyRouter catalog and map it to fx model metadata.
 * Uses the global `fetch` by default; pass `fetchImpl` to override.
 */
export async function fetchAnyRouterModels(
  fetchImpl: typeof fetch = fetch,
  url: string = ANYROUTER_MODELS_URL,
): Promise<Record<string, FxCustomProviderModel>> {
  const res = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`AnyRouter catalog fetch failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as AnyRouterModelsResponse;
  return mapCatalogModels(json);
}

export async function fetchAnyRouterProvider(
  opts: AnyRouterOptions & { fetchImpl?: typeof fetch } = {},
): Promise<FxCustomProviderDefinition> {
  const models = (await fetchAnyRouterModels(opts.fetchImpl)) as unknown as FxCustomProviderDefinition["models"];
  return anyrouter({ ...opts, models });
}

export { ANYROUTER_PROVIDER_NAME, ANYROUTER_BASE_URL, ANYROUTER_MODELS_URL };
export type { FxCustomProvider, FxCustomProviderDefinition, FxApiKeyCredentials };
