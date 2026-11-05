// Smoke: one real fx agent call against AnyRouter, only when ANYROUTER_API_KEY
// is set. Never prints the key. Uses libfx's Node entry; the engine call is
// the happy path docs describe: createFxAgent + session().prompt() streaming text_delta.
import { createFxAgent } from "libfx";
import { anyrouter, anyrouterCredentials } from "../src/index.js";

const MODEL = process.env.SMOKE_MODEL ?? "anyrouter/hermes";
const PROMPT = process.env.SMOKE_PROMPT ?? "Reply with exactly: ok";

const apiKey = process.env.ANYROUTER_API_KEY;
if (!apiKey) {
  console.log("smoke: ANYROUTER_API_KEY not set, skipping (no call made)");
  process.exit(0);
}

const agent = createFxAgent({
  provider: anyrouter(),
  model: MODEL,
  credentials: anyrouterCredentials(),
  instructions: "Reply in at most five words.",
});

const turn = agent.session().prompt(PROMPT);
let text = "";
for await (const event of turn) {
  if (event.type === "text_delta") {
    process.stdout.write(event.delta);
    text += event.delta;
  }
}
const result = await turn.result;
console.log("\n--- turn result:", result.stopReason, result.usage ?? "");
if (result.stopReason === "error") {
  console.error("smoke: turn errored", result.error ?? "");
  process.exit(1);
}
console.log(`smoke: done (${text.length} chars)`);
await agent.close();
