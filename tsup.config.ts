import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/mastra/stdio.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: true,
  shims: false,
  // Bundle everything except Node.js built-ins to avoid module system conflicts
  noExternal: [/.*/], // Bundle all dependencies
  external: [
    // Node.js built-ins only
    "fs",
    "fs/promises",
    "path",
    "url",
    "crypto",
    "stream",
    "util",
    "events",
    "buffer",
    "process",
    "os",
    "child_process",
    "net",
    "http",
    "https",
    "zlib",
    "tty",
    "readline",
    "perf_hooks",
    "worker_threads",
    "async_hooks",
    "v8",
    "vm",
    "module",
  ],
  esbuildOptions(options) {
    options.mainFields = ["module", "main"];
    options.conditions = ["node", "import"];
    options.platform = "node";
    // Allow dynamic require for bundled CommonJS dependencies
    options.banner = {
      js: `import { createRequire } from 'module';
import { fileURLToPath as fileURLToPath$ } from 'url';
import { dirname as dirname$ } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath$(import.meta.url);
const __dirname = dirname$(__filename);`,
    };
  },
});
