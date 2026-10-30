/**
 * Exports the single TypeScript demo pack to JSON for the FastAPI server and
 * for the provenance/audit tests. Run from web/: npm run pack
 */
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const result = await build({
  entryPoints: [resolve(here, "../src/data/pack.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});

const code = result.outputFiles[0].text;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const mod = await import(moduleUrl);
const target = resolve(here, "../../server/cue/data/show.json");
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(mod.PACK, null, 2) + "\n", "utf8");
console.log(`wrote ${target}`);
