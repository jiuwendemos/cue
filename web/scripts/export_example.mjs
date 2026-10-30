/**
 * Materialise the Harbour Lights worked example.
 *
 * The scenario lives in `src/data/example.ts` so the app can load it with one
 * click. This script bundles that module and writes the same pack as JSON, so
 * the repo has a real file you can import on another machine. It also copies
 * the two sample uploads into `public/` so the app can offer them for download.
 *
 *   cd web && npm run example
 */
import { build } from "esbuild";
import { copyFile, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const web = resolve(".");
const repo = resolve("..");
const outDir = await mkdtemp(join(tmpdir(), "cue-example-"));
const outfile = join(outDir, "example.mjs");

await build({
  entryPoints: [join(web, "src/data/example.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  logLevel: "silent",
});

const { createExamplePack } = await import(pathToFileURL(outfile).href);
const pack = createExamplePack();
const json = `${JSON.stringify(pack, null, 2)}\n`;
const files = ["cues-grandma3.csv", "fixtures-vectorworks.csv"];

for (const dir of [join(repo, "examples/harbour-lights"), join(web, "public/examples/harbour-lights")]) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "show-pack.json"), json, "utf8");
  for (const file of files) {
    await copyFile(join(repo, "examples/harbour-lights", file), join(dir, file));
  }
}

console.log(
  `wrote ${pack.venues.length} venues, ${pack.looks.length} looks, ${pack.cues.length} cues, ${pack.rig.fixtures.length} fixtures, ${pack.risks.length} risks`,
);
