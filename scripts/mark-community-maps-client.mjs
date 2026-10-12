import { readFileSync, writeFileSync } from "node:fs";
for (const ext of ["js", "mjs"]) {
  const path = `dist/community-maps/index.${ext}`;
  writeFileSync(path, '"use client";\n' + readFileSync(path, "utf8"));
}
