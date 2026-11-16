import { defineConfig } from "@playwright/test";
import { port, python, root } from "./e2e/runtime";

const quotedPython = `'${python.replaceAll("'", "'\\''")}'`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: `npm run build:page && ${quotedPython} -m molplot serve page/e2e/fixtures/first.py --port ${port} --no-open`,
    cwd: root,
    url: `http://127.0.0.1:${port}/api/figures`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
