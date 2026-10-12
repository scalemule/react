#!/usr/bin/env node
import { createRequire } from "node:module";
import { mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
const require = createRequire(import.meta.url);
const source = resolve(
  dirname(require.resolve("maplibre-gl/package.json")),
  "dist/maplibre-gl-worker.mjs",
);
const target = resolve(
  process.argv[2] || "public",
  "_scalemule/community-maps",
);
mkdirSync(target, { recursive: true });
const version = require("maplibre-gl/package.json").version;
copyFileSync(source, resolve(target, `maplibre-gl-worker-${version}.mjs`));
