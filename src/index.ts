import { installAntiCheatPatch } from "./core/antiCheat";
import { createApi } from "./core/api";
import { detectContext } from "./core/context";
import { findStateNode } from "./core/state";
import { mountPanel } from "./ui/gui";

export function bootstrap(): void {
  if ((window as any).__cheetosLoaded) {
    (window as any).__cheetosShow?.();
    return;
  }
  (window as any).__cheetosLoaded = true;

  installAntiCheatPatch();
  const api = createApi();
  (window as any).cheetos = api;

  const panel = mountPanel(api);
  let signature = "";

  const refresh = () => {
    const ctx = detectContext();
    if (ctx.signature !== signature) {
      signature = ctx.signature;
      panel.update(ctx);
      const node = findStateNode();
      const hasController = !!node?.props?.liveGameController;
      console.log(
        "%c[Cheetos]%c " +
          window.location.hostname +
          window.location.pathname +
          " -> " +
          ctx.kind +
          (ctx.modeId ? "/" + ctx.modeId : "") +
          (ctx.live ? " (live" : " (waiting") +
          ")" +
          (ctx.kind === "game" && !hasController ? " [state node not ready]" : ""),
        "color:#facc15",
        "color:inherit",
      );
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
