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
  querySelectorAll: () => [],
};

const cases: Array<[string, string, string]> = [
  ["play.blooket.com", "/play/gold", "game:gold"],
  ["play.blooket.com", "/play/gold/final", "game:gold"],
  ["play.blooket.com", "/gold/play/landing", "game:gold"],
  ["play.blooket.com", "/play/hack", "game:crypto"],
  ["play.blooket.com", "/play/hack/final", "game:crypto"],
  ["play.blooket.com", "/hack/play/landing", "game:crypto"],
  ["play.blooket.com", "/play/fishing", "game:fishing"],
  ["play.blooket.com", "/play/fishing/final", "game:fishing"],
  ["play.blooket.com", "/fish/play/landing", "game:fishing"],
  ["play.blooket.com", "/defense", "game:defense"],
  ["play.blooket.com", "/defense/load", "game:defense"],
  ["play.blooket.com", "/defense/final", "game:defense"],
  ["play.blooket.com", "/defense/play/landing", "game:defense"],
  ["play.blooket.com", "/defense2/load", "dashboard:-"],
  ["play.blooket.com", "/tower/load", "game:tower"],
  ["play.blooket.com", "/tower/battle", "game:tower"],
  ["play.blooket.com", "/tower/map", "game:tower"],
  ["play.blooket.com", "/tower/rest", "game:tower"],
  ["play.blooket.com", "/tower/shop", "game:tower"],
  ["play.blooket.com", "/tower/play/landing", "game:tower"],
  ["play.blooket.com", "/kingdom", "game:kingdom"],
  ["play.blooket.com", "/kingdom/start", "game:kingdom"],
  ["play.blooket.com", "/kingdom/final", "game:kingdom"],
  ["play.blooket.com", "/play/toy", "game:workshop"],
  ["play.blooket.com", "/play/toy/final", "game:workshop"],
  ["play.blooket.com", "/toy/play/landing", "game:workshop"],
  ["play.blooket.com", "/cafe", "game:cafe"],
  ["play.blooket.com", "/cafe/shop", "game:cafe"],
  ["play.blooket.com", "/cafe/play/landing", "game:cafe"],
  ["play.blooket.com", "/play/factory/settings", "game:factory"],
  ["play.blooket.com", "/play/factory/start", "game:factory"],
  ["play.blooket.com", "/play/factory/final", "game:factory"],
  ["play.blooket.com", "/factory/play/landing", "game:factory"],
  ["play.blooket.com", "/play/rush", "game:rush"],
  ["play.blooket.com", "/play/rush/final", "game:rush"],
  ["play.blooket.com", "/play/brawl", "game:brawl"],
  ["play.blooket.com", "/play/brawl/start", "game:brawl"],
  ["play.blooket.com", "/play/brawl/settings", "game:brawl"],
  ["play.blooket.com", "/brawl/play/landing", "game:brawl"],
  ["play.blooket.com", "/play/dino", "game:dino"],
  ["play.blooket.com", "/play/dino/final", "game:dino"],
  ["play.blooket.com", "/dino/play/landing", "game:dino"],
  ["play.blooket.com", "/play/classic/question", "game:global"],
  ["play.blooket.com", "/play/classic/final", "game:global"],
  ["play.blooket.com", "/classic/play/landing", "game:global"],
  ["play.blooket.com", "/play/racing", "game:racing"],
  ["play.blooket.com", "/play/racing/final", "game:racing"],
  ["play.blooket.com", "/racing/play/landing", "game:racing"],
  ["play.blooket.com", "/play/voyage", "game:voyage"],
  ["play.blooket.com", "/play/voyage/final", "game:voyage"],
  ["play.blooket.com", "/voyage/play/landing", "game:voyage"],
  ["play.blooket.com", "/play/battle-royale/question", "dashboard:-"],
  ["play.blooket.com", "/play/lobby", "lobby:-"],
  ["play.blooket.com", "/join", "lobby:-"],
  ["play.blooket.com", "/play", "lobby:-"],
  ["play.blooket.com", "/blooks", "dashboard:-"],
  ["www.blooket.com", "/dashboard", "dashboard:-"],
  ["www.blooket.com", "/", "dashboard:-"],
  ["www.blooket.com", "/market", "dashboard:-"],
  ["gold.blooket.com", "/abc/play/xyz", "game:gold"],
  ["crypto.blooket.com", "/abc/play/xyz", "game:crypto"],
  ["hack.blooket.com", "/abc/play/xyz", "game:crypto"],
  ["fishing.blooket.com", "/abc/play/xyz", "game:fishing"],
  ["fish.blooket.com", "/abc/play/xyz", "game:fishing"],
  ["defense.blooket.com", "/abc/play/xyz", "game:defense"],
  ["brawl.blooket.com", "/abc/play/xyz", "game:brawl"],
  ["dino.blooket.com", "/abc/play/xyz", "game:dino"],
  ["cafe.blooket.com", "/abc/play/xyz", "game:cafe"],
  ["factory.blooket.com", "/abc/play/xyz", "game:factory"],
  ["rush.blooket.com", "/abc/play/xyz", "game:rush"],
  ["tower.blooket.com", "/abc/play/xyz", "game:tower"],
  ["doom.blooket.com", "/abc/play/xyz", "game:tower"],
  ["kingdom.blooket.com", "/abc/play/xyz", "game:kingdom"],
  ["toy.blooket.com", "/abc/play/xyz", "game:workshop"],
  ["santa.blooket.com", "/abc/play/xyz", "game:workshop"],
  ["classic.blooket.com", "/abc/play/xyz", "game:global"],
  ["racing.blooket.com", "/abc/play/xyz", "game:racing"],
  ["voyage.blooket.com", "/abc/play/xyz", "game:voyage"],
  ["pirate.blooket.com", "/abc/play/xyz", "game:voyage"],
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
