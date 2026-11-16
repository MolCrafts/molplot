import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("../..", import.meta.url));
const localPython = path.join(root, "python", ".venv", "bin", "python");
export const python =
  process.env.MOLPLOT_PYTHON ??
  (existsSync(localPython) ? localPython : "python3");
export const port = 18877;
