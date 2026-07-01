import { buildSync } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = __dirname;
const dist = resolve(__dirname, "dist");

const SCRIPTS = [
  "state.js", "visit.js", "terrain.js", "viewmodel.js",
  "data-loader.js", "map-init.js", "ranking.js", "nav.js",
  "ui-events.js", "mobile-ui.js", "overlay-3d.js", "print.js", "admin.js",
];

mkdirSync(dist, { recursive: true });

const concat = SCRIPTS.map((f) => readFileSync(resolve(src, f), "utf8")).join("\n");
const tmpBundle = resolve(dist, "_bundle.tmp.js");
writeFileSync(tmpBundle, concat);

buildSync({
  entryPoints: [tmpBundle],
  outfile: resolve(dist, "app.min.js"),
  minify: true,
  target: "es2020",
  bundle: false,
});

buildSync({
  entryPoints: [resolve(src, "style.css")],
  outfile: resolve(dist, "style.min.css"),
  minify: true,
  bundle: false,
});

import("fs").then(({ unlinkSync }) => {
  try { unlinkSync(tmpBundle); } catch {}
});

let html = readFileSync(resolve(src, "index_3.html"), "utf8");

const scriptTagsRe = SCRIPTS.map(
  (f) => `<script src="${f}"></script>`
).join("\\s*");
html = html.replace(
  new RegExp(scriptTagsRe),
  '<script src="app.min.js"></script>'
);
html = html.replace(
  '<link rel="stylesheet" href="style.css">',
  '<link rel="stylesheet" href="style.min.css">'
);

writeFileSync(resolve(dist, "index_3.html"), html);

for (const f of [
  "data-version.json", "icon.png",
  "manifest.webmanifest", "sw.js",
  "icon-192.png", "icon-512.png", "icon-512-maskable.png", "icon-180.png",
]) {
  if (existsSync(resolve(src, f))) {
    cpSync(resolve(src, f), resolve(dist, f));
  }
}

for (const d of ["targets", "terrain_elevations", "road_closures", "tourism_spots", "toll_roads", "logistics", "route_numbers"]) {
  const srcDir = resolve(src, d);
  if (existsSync(srcDir)) {
    const destDir = resolve(dist, d);
    if (!existsSync(destDir)) {
      cpSync(srcDir, destDir, { recursive: true, dereference: false });
    }
  }
}

const origSize = SCRIPTS.reduce((s, f) => s + readFileSync(resolve(src, f)).length, 0);
const minSize = readFileSync(resolve(dist, "app.min.js")).length;
const cssOrig = readFileSync(resolve(src, "style.css")).length;
const cssMin = readFileSync(resolve(dist, "style.min.css")).length;
console.log(`JS:  ${(origSize / 1024).toFixed(1)}KB → ${(minSize / 1024).toFixed(1)}KB (${Math.round((1 - minSize / origSize) * 100)}% reduced)`);
console.log(`CSS: ${(cssOrig / 1024).toFixed(1)}KB → ${(cssMin / 1024).toFixed(1)}KB (${Math.round((1 - cssMin / cssOrig) * 100)}% reduced)`);
console.log(`→ dist/index_3.html ready`);
