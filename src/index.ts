import { installAntiCheatPatch } from "./core/antiCheat";
import { createApi } from "./core/api";
import { detectContext } from "./core/context";
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
