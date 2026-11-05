import type { FxCustomProviderModel } from "libfx";

export const ANYROUTER_PROVIDER_NAME = "anyrouter";
export const ANYROUTER_BASE_URL = "https://anyrouter.dev/api/v1";
export const ANYROUTER_MODELS_URL = "https://anyrouter.dev/api/v1/models";
export const ANYROUTER_API_KEY_ENV = "ANYROUTER_API_KEY";

export interface AnyRouterCatalogModel {
  id: string;
  context_length?: number | null;
  supported_parameters?: string[] | null;
  architecture?: {
    input_modalities?: string[] | null;
    output_modalities?: string[] | null;
    modality?: string | null;
  } | null;
  top_provider?: {
    max_completion_tokens?: number | null;
  } | null;
  // tolerated aliases some catalog edges / mirrors emit
  max_completion_tokens?: number | null;
  input_modalities?: string[] | null;
}

export interface AnyRouterModelsResponse {
  data: AnyRouterCatalogModel[];
}

const OUTBOUND_MODALITIES = new Set(["text", "image", "audio", "video"]);
const IMAGE_INPUT_MODALITIES = new Set(["image", "video"]);

// kept for future modality filtering; referenced to avoid unused lints
void OUTBOUND_MODALITIES;

/** True when the catalog entry accepts a tool-calling parameter. fx's
 * `supportsToolUse` means the model can call tools in a turn. AnyRouter's
 * catalog signals this via `supported_parameters` containing tools.
 */
export function entrySupportsToolUse(entry: AnyRouterCatalogModel): boolean {
  const params = entry.supported_parameters;
  if (Array.isArray(params)) return params.includes("tools");
  return false;
}

/** True when the catalog entry accepts image (or video, which carries frames)
 * as input: `architecture.input_modalities` containing an image-like modality.
 */
export function entrySupportsVision(entry: AnyRouterCatalogModel): boolean {
  const modalities =
    entry.architecture?.input_modalities ?? entry.input_modalities ?? null;
  if (!Array.isArray(modalities)) return false;
  return modalities.some((m) => IMAGE_INPUT_MODALITIES.has(m));
}

function positiveIntFromCatalog(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const int = Math.floor(value);
  return int > 0 ? int : undefined;
}

function positiveInt(value: unknown): number | undefined {
  return positiveIntFromCatalog(value);
}

export function maxCompletionTokensOf(entry: AnyRouterCatalogModel): number | undefined {
  return positiveInt(entry.top_provider?.max_completion_tokens ?? entry.max_completion_tokens);
}

/** Map one AnyRouter catalog entry to fx's model metadata. Fields fx
 * considers unknown are omitted (unset in fx means unknown); fx requires
 * `contextWindow` / `maxOutputTokens` to be positive integers when set, and
 * `maxOutputTokens < contextWindow` when both are set.
 */
export function mapCatalogEntry(
  entry: AnyRouterCatalogModel,
): FxCustomProviderModel {
  const out: FxCustomProviderModel = {};

  const contextLength = positiveInt(entry.context_length);
  if (contextLength !== undefined) out.contextWindow = contextLength;

  const completion = maxCompletionTokensOf(entry);
  if (completion !== undefined) {
    if (out.contextWindow !== undefined && completion >= out.contextWindow) {
      // fx rejects `maxOutputTokens >= contextWindow`; clamp to the largest
      // legal value, which is still a faithful "very large output" signal.
      out.maxOutputTokens = out.contextWindow - 1;
    } else {
      out.maxOutputTokens = completion;
    }
  }

  // Only advertise the boolean when the catalog positively signals it. When
  // the catalog omits the signal entirely (e.g. decision/rerank/embedding
  // routes that never take tools), include the false so fx doesn't enable
  // tool calls blindly. For vision: advertises input modalities, so absent
  // means text-only.
  out.supportsToolUse = entrySupportsToolUse(entry);
  out.supportsVision = entrySupportsVision(entry);

  return out;
}

/** Map the live catalog (or a fixture) to the `models` record fx expects.
 * Returns only the mapped metadata; ids are the catalog keys.
 */
export function mapCatalogModels(
  catalog: readonly AnyRouterCatalogModel[] | AnyRouterModelsResponse,
): Record<string, FxCustomProviderModel> {
  const entries: readonly AnyRouterCatalogModel[] = Array.isArray(catalog)
    ? (catalog as readonly AnyRouterCatalogModel[])
    : (catalog as AnyRouterModelsResponse).data;
  const out: Record<string, FxCustomProviderModel> = {};
  for (const entry of entries) {
    if (!entry || typeof entry.id !== "string" || entry.id.length === 0) continue;
    // fx enforces a max of 256 models and a 1024-byte id cap; skip ids that
    // would make `customProviderDefinition` throw.
    if (entry.id.trim() !== entry.id || /[\u0000-\u001f\u007f]/.test(entry.id)) continue;
    out[entry.id] = mapCatalogEntry(entry);
  }
  return out;
}
