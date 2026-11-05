import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAnyRouterModels } from "../src/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "src", "models.snapshot.json");

const models = await fetchAnyRouterModels();
const snapshot = {
  // Store the mapped record, not the raw catalog: the runtime maps a static
  // snapshot quickly and the committed JSON stays small and reviewable.
  // The mapping is deterministic, so regenerated snapshots are diff-stable.
  models,
};

await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, JSON.stringify(snapshot, null, 2) + "\n", "utf8");
console.log(`wrote ${Object.keys(models).length} models to ${out}`);
