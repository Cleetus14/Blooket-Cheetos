import { installAntiCheatPatch } from "./core/antiCheat";
import { createApi } from "./core/api";
import { detectContext } from "./core/context";
import { debugDump, stateDiagnostics } from "./core/state";
import { mountPanel } from "./ui/gui";
import { VERSION } from "./version";

export function bootstrap(): void {
  const loaded = !!(window as any).__cheetosLoaded;
  if (loaded && (window as any).__cheetosVersion === VERSION) {
    (window as any).__cheetosShow?.();
    return;
  }
  if (loaded) {
    try {
      (window as any).__cheetosTeardown?.();
    } catch {
      /* ignore */
    }
    (window as any).__cheetosLoaded = false;
  }
  (window as any).__cheetosLoaded = true;
  (window as any).__cheetosVersion = VERSION;

  installAntiCheatPatch();
  const api = createApi();
  (window as any).cheetos = api;
  (window as any).__cheetosDebug = () => {
    const dump = debugDump();
    console.log(
      "%c[Cheetos debug]%c " + JSON.stringify(dump, null, 1),
      "color:#facc15",
      "color:inherit",
    );
    return dump;
  };

  const panel = mountPanel(api);
  (window as any).__cheetosTeardown = () => {
    try {
      panel.teardown?.();
    } catch {
      /* ignore */
    }
    (window as any).__cheetosLoaded = false;
  };

  let signature = "";
  let prevFound: boolean | null = null;

  const refresh = () => {
    const ctx = detectContext();
    const diag = stateDiagnostics();
    const found = !!diag.found;

    if (ctx.signature !== signature || found !== prevFound) {
      signature = ctx.signature;
      prevFound = found;
      panel.update(ctx);
      console.log(
        "%c[Cheetos]%c " +
          window.location.hostname +
          window.location.pathname +
          " -> " +
          ctx.kind +
          (ctx.modeId ? "/" + ctx.modeId : "") +
          (ctx.live ? " (live" : " (waiting") +
          ")" +
          (found ? "" : " [state node not found]"),
        "color:#facc15",
        "color:inherit",
      );
      console.log(
        "%c[Cheetos state]%c " + JSON.stringify(diag),
        "color:#facc15",
        "color:inherit",
      );
      if (found && ctx.kind === "game") {
        api.log("Game state found. Cheats ready.");
      }
    }
  };

  refresh();
  window.addEventListener("popstate", refresh);
  window.setInterval(() => {
    if (!document.body.contains(panel.root)) panel.reattach();
    refresh();
  }, 900);
}

bootstrap();
