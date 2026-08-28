import { build } from "esbuild";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = mkdtempSync(join(tmpdir(), "cheetos-smoke-"));

const entry = `
import { detectContext } from "./src/core/context";

globalThis.window = { location: { hostname: "", pathname: "" } };
globalThis.document = {
  getElementById: () => null,
  body: { children: [] },
  querySelector: () => null,
};

const cases: Array<[string, string, string]> = [
  ["play.blooket.com", "/play/gold", "game:gold"],
  ["play.blooket.com", "/play/gold/final", "game:gold"],
  ["play.blooket.com", "/gold/play/landing", "game:gold"],
  ["play.blooket.com", "/play/hack", "game:crypto"],
  ["play.blooket.com", "/play/fishing", "game:fishing"],
  ["play.blooket.com", "/fish/play/landing", "game:fishing"],
  ["play.blooket.com", "/defense", "game:defense"],
  ["play.blooket.com", "/defense/load", "game:defense"],
  ["play.blooket.com", "/defense2/load", "dashboard:-"],
  ["play.blooket.com", "/tower/battle", "game:tower"],
  ["play.blooket.com", "/tower/map", "game:tower"],
  ["play.blooket.com", "/kingdom", "game:kingdom"],
  ["play.blooket.com", "/play/toy/final", "game:workshop"],
  ["play.blooket.com", "/cafe/shop", "game:cafe"],
  ["play.blooket.com", "/play/factory/settings", "game:factory"],
  ["play.blooket.com", "/play/rush", "game:rush"],
  ["play.blooket.com", "/play/brawl", "game:brawl"],
  ["play.blooket.com", "/play/dino", "game:dino"],
  ["play.blooket.com", "/play/lobby", "lobby:-"],
  ["play.blooket.com", "/join", "lobby:-"],
  ["play.blooket.com", "/play", "lobby:-"],
  ["play.blooket.com", "/blooks", "dashboard:-"],
  ["www.blooket.com", "/dashboard", "dashboard:-"],
  ["www.blooket.com", "/", "dashboard:-"],
  ["www.blooket.com", "/market", "dashboard:-"],
  ["google.com", "/", "other:-"],
];

let failed = 0;
for (const [host, path, want] of cases) {
  window.location.hostname = host;
  window.location.pathname = path;
  const ctx = detectContext();
  const got = ctx.kind + ":" + (ctx.modeId ?? "-");
  const ok = got === want;
  if (!ok) failed++;
  console.log((ok ? "PASS" : "FAIL") + "  " + host + path + "  ->  " + got + (ok ? "" : " (want " + want + ")"));
}
if (failed) process.exit(1);
console.log("context smoke: all passed");
`;

const entryFile = join(root, ".smoke-entry.ts");
const outFile = join(tmp, "out.mjs");
writeFileSync(entryFile, entry);

await build({
  entryPoints: [entryFile],
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node18",
  outfile: outFile,
  logLevel: "error",
});

try {
  const out = execFileSync(process.execPath, [outFile], { encoding: "utf8", cwd: root });
  console.log(out);
} catch (err) {
  if (err.stdout) process.stdout.write(String(err.stdout));
  if (err.stderr) process.stderr.write(String(err.stderr));
  process.exitCode = 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
  rmSync(entryFile, { force: true });
}
