# fx-provider-anyrouter

Use [AnyRouter](https://anyrouter.dev) as a provider in [fx](https://fx.sh) ([libfx](https://fx.sh/docs/lib)) with one line. AnyRouter is an OpenAI-compatible gateway; fx agents can run on any OpenAI Chat Completions server through a custom provider. This package is that provider, ready to paste into `createFxAgent`.

## Install

```bash
npm install fx-provider-anyrouter
```

`libfx` is a peer dependency (`^0.0.16`, the npm package that ships `createFxAgent` and the `FxCustomProvider` types).

## Quick start

```ts
import { createFxAgent } from "libfx";
import { anyrouter, anyrouterCredentials } from "fx-provider-anyrouter";

const agent = createFxAgent({
  provider: anyrouter(),
  model: "anyrouter/hermes",
  credentials: anyrouterCredentials(),
});

const turn = agent.session().prompt("Hello");
for await (const event of turn) {
  if (event.type === "text_delta") process.stdout.write(event.delta);
}
```

Get a key at https://anyrouter.dev and set `ANYROUTER_API_KEY` in the environment. `anyrouterCredentials()` reads it when fx calls `credentials()` for the turn, in whichever process runs it, and returns `{ apiKey }`. No key is stored in your code, logged, or committed.

If you want the `FxCustomProvider` shape directly:

```ts
import { anyrouterAgent } from "fx-provider-anyrouter";

createFxAgent({ ...anyrouterAgent(), model: "anyrouter/hermes" });
```

## Models

Model ids use AnyRouter's `owner/model` form. Examples from the live catalog (https://anyrouter.dev/api/v1/models) include:

| Id | Notes |
|---|---|
| `anyrouter/hermes` | Auto-routes across top tool-calling models, with fallback. |
| `anyrouter/auto` | Auto-routes across coding and vision-capable models. |
| `google/gemma-4-31b` | Tool and vision capable. |
| `openai/gpt-5.6-luna` | Tool and vision capable. |
| `moonshotai/kimi-k3` | 1M context, agentic. |

`model` must be a model this provider serves; fx's default model is an AI Gateway id and will not work with a custom provider.

## Options

`anyrouter(opts?)`:

| Option | Default | Purpose |
|---|---|---|
| `baseUrl` | `https://anyrouter.dev/api/v1` | API prefix; fx calls `{baseUrl}/chat/completions`. Use a relay URL if you self-host. |
| `name` | `anyrouter` | Provider name passed to fx `credentials()`. Must follow fx's naming rule (letter first, letters/digits/`_`/`-`, at most 64 chars; not `gateway`/`codex`/`grok`). |
| `models` | bundled snapshot | Pre-mapped `models` record. Replace the snapshot if you filter the catalog. |

`fetchAnyRouterModels()` fetches the live catalog and returns the mapped `models` record. `fetchAnyRouterProvider()` returns a ready `anyrouter()` provider built from fresh data.

```ts
import { fetchAnyRouterProvider } from "fx-provider-anyrouter";

const provider = await fetchAnyRouterProvider();
createFxAgent({ provider, model: "anyrouter/hermes", credentials: anyrouterCredentials() });
```

## How the mapping works

Each AnyRouter catalog entry becomes one fx `FxCustomProviderModel`:

- `contextWindow` from the catalog's `context_length`.
- `maxOutputTokens` from `top_provider.max_completion_tokens` (`maxOutputTokens` at the top level is tolerated as a fallback). Clamped to `contextWindow - 1` when both are present, because fx rejects `maxOutputTokens >= contextWindow`.
- `supportsToolUse` from whether `supported_parameters` includes `tools`.
- `supportsVision` from whether `architecture.input_modalities` includes `image` or `video`.

Unknown fields are omitted, which fx treats as unknown. Models with the catalog's disabled routes (decision, rerank, embedding) get `supportsToolUse: false` and `supportsVision: false`, so fx does not enable tool calls or images for them blindly. The snapshot ships as `src/models.snapshot.json` and is regenerated with `npm run snapshot`; the committed snapshot is the one `anyrouter()` uses by default, so your app works offline at startup.

## Attribution headers

AnyRouter docs suggest attribution headers (`HTTP-Referer`, `X-Title`) for apps. fx does not allow custom headers on a custom provider: the provider object must be exactly `{ name, baseUrl, models }`, per fx's `customProviderDefinition` (sdk/custom-provider.js), and the host adds only the `Authorization: Bearer <key>` header at the fetch edge. So this package skips attribution headers and says so in the report. If you need them, patch the host-side fetch wrapper or add them in your proxy, not in this provider.

## Development

```bash
npm install
npm test          # vitest
npm run build     # tsc
npm run snapshot  # regenerate src/models.snapshot.json from the live catalog
npm run smoke     # one real fx agent call when ANYROUTER_API_KEY is set (SMOKE_MODEL overrides the model)
```

The smoke script reads `ANYROUTER_API_KEY` from the environment and never prints it. Without the key it skips with a clear message.

## Requirements

- Node.js 20+.
- `libfx` (peer) for `createFxAgent` and its types.

## License

MIT. See [LICENSE](LICENSE).
