/**
 * Bundle budget gate. The entry bundle is the first load; the WebGL previz
 * must stay an on-demand chunk. Run after `npm run build`.
 */
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const assets = join(process.cwd(), "dist", "assets");
const files = readdirSync(assets).filter((file) => file.endsWith(".js"));
const sizes = files.map((file) => ({
  file,
  gzip: gzipSync(readFileSync(join(assets, file))).length,
}));
const entry = sizes.find((item) => /^index-.*\.js$/.test(item.file));
const three = sizes.find((item) => /^Stage3D-.*\.js$/.test(item.file));
const ENTRY_BUDGET = 220_000;
const CHUNK_BUDGET = 180_000;
let failed = false;
for (const item of sizes) {
  const budget = item === entry ? ENTRY_BUDGET : CHUNK_BUDGET;
  const status = item.gzip <= budget ? "ok" : "FAIL";
  if (item.gzip > budget) failed = true;
  console.log(`${status.padEnd(4)} ${item.file} ${(item.gzip / 1024).toFixed(1)} kB gzip (budget ${(budget / 1024).toFixed(0)} kB)`);
}
if (!entry) {
  console.error("FAIL no index-*.js entry bundle found");
  failed = true;
}
if (!three) {
  console.error("FAIL no Stage3D-*.js on-demand chunk found");
  failed = true;
}
if (failed) process.exit(1);
console.log("bundle budget passed");
