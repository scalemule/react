import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts", "src/community-maps/index.ts", "src/conversion-bar/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  external: ["react", "@scalemule/sdk", "maplibre-gl"],
});
