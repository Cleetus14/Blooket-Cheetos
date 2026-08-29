import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const watching = process.argv.includes("--watch");

// The bundle ships inline in the bookmark URL.
function makeBookmarklet() {
  const code = readFileSync(resolve(root, "dist/cheetos.js"), "utf8").trim();
  const encoded = encodeURIComponent(code).replace(/'/g, "%27");
  if (decodeURIComponent(encoded) !== code) {
    throw new Error("bookmarklet round-trip check failed");
  }
  return "javascript:" + encoded;
}

function writeDist() {
  const bookmarklet = makeBookmarklet();
  writeFileSync(resolve(root, "dist/bookmarklet.txt"), bookmarklet);

  const template = readFileSync(resolve(root, "bookmarklets/import.html"), "utf8");
  const html = template.split("__BOOKMARKLET__").join(bookmarklet);
  if (html === template) {
    throw new Error("import.html template is missing the __BOOKMARKLET__ placeholder");
  }
  writeFileSync(resolve(root, "dist/index.html"), html);

  console.log(
    "wrote dist/bookmarklet.txt (" + bookmarklet.length + " chars) and dist/index.html",
  );
}

async function run() {
  mkdirSync(resolve(root, "dist"), { recursive: true });

  const shared = {
    entryPoints: [resolve(root, "src/index.ts")],
    bundle: true,
    minify: true,
    format: "iife",
    target: "es2019",
    outfile: resolve(root, "dist/cheetos.js"),
    logLevel: "info",
  };

  if (watching) {
    await build({
      ...shared,
      watch: {
        onRebuild(error) {
          if (error) console.error(error);
          else {
            try {
              writeDist();
              console.log("rebuilt dist/cheetos.js");
            } catch (err) {
              console.error(err);
            }
          }
        },
      },
    });
    writeDist();
    console.log("watching src/ for changes...");
  } else {
    await build(shared);
    writeDist();
    console.log("built dist/cheetos.js");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
