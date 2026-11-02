import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "@rstest/core";

const here = dirname(fileURLToPath(import.meta.url));
const semanticDir = join(here, "../../src/semantic");

const BANNED = [
  'from "vega"',
  "from 'vega'",
  'from "vega-lite"',
  "from 'vega-lite'",
  'from "vega-embed"',
  "import matplotlib",
  "from matplotlib",
  "Line2D",
  "PathCollection",
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (path.endsWith(".ts")) out.push(path);
  }
  return out;
}

describe("semantic isolation", () => {
  it("does not import a backend", () => {
    const files = walk(semanticDir);
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const token of BANNED) {
        expect({ file, token, hit: text.includes(token) }).toEqual({
          file,
          token,
          hit: false,
        });
      }
    }
  });
});
