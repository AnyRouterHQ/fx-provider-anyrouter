import { describe, expect, it } from "vitest";
import { anyrouter, bundledModels } from "../src/index.js";
import {
  ANYROUTER_BASE_URL,
  ANYROUTER_PROVIDER_NAME,
} from "../src/mapping.js";

// Mirror of fx's customProviderDefinition checks (sdk/custom-provider.js).
const namePattern = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const reservedNames = new Set(["gateway", "codex", "grok"]);
const providerFields = new Set(["name", "baseUrl", "models"]);
const modelFields = new Set([
  "contextWindow",
  "maxOutputTokens",
  "supportsToolUse",
  "supportsVision",
]);

describe("provider shape accepted by fx types", () => {
  it("returns the expected shape", () => {
    const p = anyrouter();
    expect(p.name).toBe(ANYROUTER_PROVIDER_NAME);
    expect(p.name).toBe("anyrouter");
    expect(p.baseUrl).toBe(ANYROUTER_BASE_URL);
    expect(Object.keys(p).sort()).toEqual(["baseUrl", "models", "name"]);
  });

  it("passes fx customProviderDefinition validation rules", () => {
    const p = anyrouter();
    expect(namePattern.test(p.name)).toBe(true);
    expect(reservedNames.has(p.name.toLowerCase())).toBe(false);
    for (const field of Object.keys(p)) {
      expect(providerFields.has(field)).toBe(true);
    }
    expect(p.baseUrl.startsWith("https://")).toBe(true);
    expect(p.baseUrl.endsWith("/")).toBe(false);

    const models = p.models as Record<string, Record<string, unknown>>;
    expect(typeof models).toBe("object");
    for (const [id, model] of Object.entries(models)) {
      expect(id.trim()).toBe(id);
      expect(id).not.toMatch(/[\u0000-\u001f\u007f]/);
      for (const field of Object.keys(model)) {
        expect(modelFields.has(field)).toBe(true);
      }
      if (typeof model.contextWindow === "number") {
        expect(Number.isInteger(model.contextWindow)).toBe(true);
        expect(model.contextWindow!).toBeGreaterThan(0);
      }
      if (typeof model.maxOutputTokens === "number") {
        expect(Number.isInteger(model.maxOutputTokens)).toBe(true);
        if (typeof model.contextWindow === "number") {
          expect(model.maxOutputTokens!).toBeLessThan(model.contextWindow!);
        }
      }
      if (typeof model.supportsToolUse !== "undefined") {
        expect(typeof model.supportsToolUse).toBe("boolean");
      }
      if (typeof model.supportsVision !== "undefined") {
        expect(typeof model.supportsVision).toBe("boolean");
      }
    }
    expect(Object.keys(models).length).toBeLessThanOrEqual(256);
  });

  it("accepts custom baseUrl and name options", () => {
    const p = anyrouter({ baseUrl: "https://relay.example/v1", name: "relay" });
    expect(p.baseUrl).toBe("https://relay.example/v1");
    expect(p.name).toBe("relay");
  });

  it("bundled snapshot is populated", () => {
    const models = bundledModels();
    expect(models).toBeTruthy();
    expect(Object.keys(models!).length).toBeGreaterThan(0);
  });
});
