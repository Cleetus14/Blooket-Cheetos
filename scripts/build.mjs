import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const watching = process.argv.includes("--watch");

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
          else console.log("rebuilt dist/cheetos.js");
        },
      },
    });
    console.log("watching src/ for changes...");
  } else {
    await build(shared);
    copyFileSync(resolve(root, "bookmarklets/import.html"), resolve(root, "dist/index.html"));
    copyFileSync(resolve(root, "bookmarklets/bookmarklet.txt"), resolve(root, "dist/bookmarklet.txt"));
    console.log("built dist/cheetos.js");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
