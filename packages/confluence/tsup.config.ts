import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    outDir: "dist",
    dts: true,
  },
  {
    entry: { "lib/index": "src/lib/index.ts" },
    format: ["esm"],
    outDir: "dist",
    dts: true,
  },
]);
