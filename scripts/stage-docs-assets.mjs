#!/usr/bin/env node
/**
 * stage-docs-assets — copy the source-built `<molplot-chart>` runtime into
 * `docs/assets/molplot/` so the documentation site bootstraps from this repo,
 * not from a published CDN bundle.
 *
 * Walks the ESM import graph from `core/dist/elements.js` (the bundled
 * `elements` lib in `core/rslib.config.ts`) and copies only those files plus
 * adjacent LICENSE texts. The unbundled library build is skipped: those files
 * externalize vega and are not what the docs page loads.
 *
 * Usage:  npm run build:core && node scripts/stage-docs-assets.mjs
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "core", "dist");
const DEST = join(ROOT, "docs", "assets", "molplot");
const ENTRY = "elements.js";

function fail(message) {
  console.error(`stage-docs-assets: ${message}`);
  process.exit(1);
}

if (!existsSync(join(SRC, ENTRY))) {
  fail(`missing ${join(SRC, ENTRY)}. Run npm run build:core first.`);
}

const IMPORT_RE =
  /from\s*["'](\.\/[^"']+)["']|import\s*\(\s*["'](\.\/[^"']+)["']\s*\)/g;

function collect(file, seen) {
  if (seen.has(file)) return;
  const path = join(SRC, file);
  if (!existsSync(path)) {
    fail(`chunk "${file}" is imported but missing under core/dist`);
  }
  seen.add(file);
  const text = readFileSync(path, "utf8");
  for (const match of text.matchAll(IMPORT_RE)) {
    const spec = match[1] ?? match[2];
    collect(spec.replace(/^\.\//, ""), seen);
  }
  const license = `${file}.LICENSE.txt`;
  if (existsSync(join(SRC, license))) seen.add(license);
}

const files = new Set();
collect(ENTRY, files);

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
for (const file of files) {
  cpSync(join(SRC, file), join(DEST, file));
}

console.log(
  `stage-docs-assets: ${files.size} files → docs/assets/molplot (${[...files].join(", ")})`,
);
