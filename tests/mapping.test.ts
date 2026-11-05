import { describe, expect, it } from "vitest";
import {
  mapCatalogEntry,
  mapCatalogModels,
  entrySupportsToolUse,
  entrySupportsVision,
  type AnyRouterCatalogModel,
} from "../src/mapping.js";

describe("mapping", () => {
  it("maps a tool model", () => {
    const entry: AnyRouterCatalogModel = {
      id: "google/gemma-4-31b",
      context_length: 262144,
      supported_parameters: ["max_tokens", "temperature", "tools", "tool_choice"],
      architecture: { input_modalities: ["text", "image"], modality: "text->text" },
      top_provider: { max_completion_tokens: 32768 },
    };
    const m = mapCatalogEntry(entry);
    expect(m.contextWindow).toBe(262144);
    expect(m.maxOutputTokens).toBe(32768);
    expect(m.supportsToolUse).toBe(true);
    expect(m.supportsVision).toBe(true);
  });

  it("maps a vision-only (no tools) model", () => {
    const entry: AnyRouterCatalogModel = {
      id: "perplexity/pplx-decider-v1-27b",
      context_length: 262144,
      supported_parameters: ["state", "model", "questions"],
      architecture: { input_modalities: ["text", "image"] },
      top_provider: { max_completion_tokens: null },
    };
    const m = mapCatalogEntry(entry);
    expect(m.supportsToolUse).toBe(false);
    expect(m.supportsVision).toBe(true);
    expect(m.contextWindow).toBe(262144);
    expect(m.maxOutputTokens).toBeUndefined();
  });

  it("omits missing fields", () => {
    const entry: AnyRouterCatalogModel = {
      id: "baai/bge-base-en-v1.5",
      context_length: 512,
      supported_parameters: ["input", "model", "encoding_format"],
      architecture: { input_modalities: ["text"] },
      top_provider: { max_completion_tokens: null },
    };
    const m = mapCatalogEntry(entry);
    expect(m.supportsToolUse).toBe(false);
    expect(m.supportsVision).toBe(false);
    expect(m.maxOutputTokens).toBeUndefined();
  });

  it("clamps maxOutputTokens < contextWindow", () => {
    const entry: AnyRouterCatalogModel = {
      id: "x/y",
      context_length: 4096,
      supported_parameters: ["tools"],
      architecture: { input_modalities: ["text"] },
      top_provider: { max_completion_tokens: 8192 },
    };
    const m = mapCatalogEntry(entry);
    expect(m.maxOutputTokens).toBeLessThan(m.contextWindow!);
  });

  it("drops zero context (fx requires positive)", () => {
    const entry: AnyRouterCatalogModel = {
      id: "perplexity/pplx-decider-flash-v1.2",
      context_length: 0,
      supported_parameters: ["state", "model", "questions"],
      architecture: { input_modalities: ["text"] },
      top_provider: { max_completion_tokens: null },
    };
    const m = mapCatalogEntry(entry);
    expect(m.contextWindow).toBeUndefined();
  });

  it("vision true for image input modality", () => {
    expect(entrySupportsVision({ id: "a/b", architecture: { input_modalities: ["text", "image"] } })).toBe(true);
    expect(entrySupportsVision({ id: "a/b", architecture: { input_modalities: ["text"] } })).toBe(false);
  });

  it("mapCatalogModels skips empty ids", () => {
    const out = mapCatalogModels([
      { id: "", context_length: 1024 },
      { id: "ok/model", context_length: 1024, supported_parameters: ["tools"] },
    ] as AnyRouterCatalogModel[]);
    expect(Object.keys(out)).toEqual(["ok/model"]);
  });
});
