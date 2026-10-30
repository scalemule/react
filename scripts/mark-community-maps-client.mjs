import { readFileSync, writeFileSync } from "node:fs";
// Client-only entry points get a "use client" banner so React Server Components can import them.
for (const entry of ["community-maps", "conversion-bar"]) {
  for (const ext of ["js", "mjs"]) {
    const path = `dist/${entry}/index.${ext}`;
    const source = readFileSync(path, "utf8");
    if (!source.startsWith('"use client"')) writeFileSync(path, '"use client";\n' + source);
  }
}
