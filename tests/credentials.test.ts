import { afterEach, describe, expect, it, vi } from "vitest";
import { anyrouterCredentials, credentials, fetchAnyRouterModels } from "../src/index.js";

describe("credentials", () => {
  afterEach(() => {
    delete process.env.ANYROUTER_API_KEY;
    vi.restoreAllMocks();
  });

  it("returns apiKey from ANYROUTER_API_KEY", async () => {
    process.env.ANYROUTER_API_KEY = "sk-ar-test";
    const fn = anyrouterCredentials();
    const out = await fn({ provider: "anyrouter", sessionId: "s1" });
    expect(out).toEqual({ apiKey: "sk-ar-test" });
  });

  it("throws with provider name when unset", async () => {
    delete process.env.ANYROUTER_API_KEY;
    const fn = anyrouterCredentials();
    await expect(fn({ provider: "anyrouter" })).rejects.toThrow(/ANYROUTER_API_KEY/);
    await expect(fn({ provider: "anyrouter" })).rejects.toThrow(/anyrouter/);
  });

  it("credentials export is the same factory", () => {
    expect(credentials).toBe(anyrouterCredentials);
  });
});

describe("fetchAnyRouterModels", () => {
  it("maps a fake catalog via injected fetch", async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              id: "google/gemma-4-31b",
              context_length: 262144,
              supported_parameters: ["tools"],
              architecture: { input_modalities: ["text", "image"] },
              top_provider: { max_completion_tokens: 32768 },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const models = await fetchAnyRouterModels(fakeFetch as never);
    expect(models["google/gemma-4-31b"]).toEqual({
      contextWindow: 262144,
      maxOutputTokens: 32768,
      supportsToolUse: true,
      supportsVision: true,
    });
  });
});
