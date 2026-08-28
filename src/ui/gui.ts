import type { CheatApi, CheatDef, ToggleHandle } from "../types";
import type { AppContext } from "../core/context";
import { MODES, type ModeDef } from "../modes";
import { globalCheats } from "../modes/global";
import { getSettings, updateSettings } from "../core/settings";

const ACTIVE: Record<string, ToggleHandle> = {};

let selectedTab = "global";
let prevLive = false;

function stopAllToggles(): void {
  for (const key of Object.keys(ACTIVE)) {
    try {
      ACTIVE[key].stop();
    } catch {
      /* noop */
    }
    delete ACTIVE[key];
  }
}

function ensureStyle(): void {
  if (document.getElementById("cheetos-style")) return;
  const css = `
#cheetos-root, #cheetos-root * { box-sizing: border-box; font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }
#cheetos-toggle { position: fixed; right: 14px; bottom: 14px; z-index: 2147483000; background: #7c3aed; color: #fff; border: none; border-radius: 999px; padding: 10px 16px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(0,0,0,.35); }
#cheetos-panel { position: fixed; top: 12px; right: 12px; z-index: 2147483001; width: 360px; max-height: 84vh; display: flex; flex-direction: column; background: #18181b; color: #e4e4e7; border: 1px solid #3f3f46; border-radius: 12px; box-shadow: 0 12px 32px rgba(0,0,0,.5); overflow: hidden; }
#cheetos-panel.hidden { display: none; }
#cheetos-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #27272a; cursor: grab; user-select: none; }
#cheetos-head .title { font-weight: 800; font-size: 15px; color: #facc15; margin-right: auto; }
#cheetos-status { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: #3f3f46; color: #a1a1aa; white-space: nowrap; }
#cheetos-status.live { background: #14532d; color: #86efac; }
#cheetos-status.waiting { background: #451a03; color: #fcd34d; }
#cheetos-close { background: none; border: none; color: #a1a1aa; font-size: 18px; cursor: pointer; }
#cheetos-tabs { display: flex; gap: 4px; overflow-x: auto; padding: 8px 10px; background: #202024; border-bottom: 1px solid #3f3f46; }
#cheetos-tabs::-webkit-scrollbar { height: 6px; }
#cheetos-tabs::-webkit-scrollbar-thumb { background: #3f3f46; border-radius: 3px; }
.cheetos-tab { flex: 0 0 auto; border: 1px solid transparent; background: transparent; color: #a1a1aa; font-size: 12px; font-weight: 700; padding: 5px 10px; border-radius: 999px; cursor: pointer; white-space: nowrap; }
.cheetos-tab:hover { background: #2c2c31; color: #e4e4e7; }
.cheetos-tab.active { background: #7c3aed; color: #fff; }
.cheetos-tab.live { border-color: #22c55e; }
#cheetos-body { overflow-y: auto; padding: 8px 10px 12px; }
.cheetos-note { padding: 10px 12px; font-size: 12.5px; color: #a1a1aa; line-height: 1.5; background: #202024; border-radius: 8px; margin-bottom: 8px; }
.cheetos-group { margin: 10px 0 4px; }
.cheetos-group-title { font-size: 12px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #a78bfa; margin-bottom: 6px; }
.cheetos-row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
.cheetos-btn { flex: 1 1 auto; min-width: 120px; text-align: left; background: #3f3f46; color: #fafafa; border: none; border-radius: 8px; padding: 7px 10px; font-size: 13px; cursor: pointer; transition: background .12s; }
.cheetos-btn:hover { background: #52525b; }
.cheetos-btn.active { background: #16a34a; }
.cheetos-btn.warn { background: #b91c1c; text-align: center; }
.cheetos-input { width: 84px; background: #27272a; color: #fafafa; border: 1px solid #52525b; border-radius: 6px; padding: 6px 7px; font-size: 12px; }
.cheetos-hint { padding: 4px 12px 10px; font-size: 11px; color: #71717a; line-height: 1.5; }
.cheetos-setting-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 0; }
.cheetos-setting-row label { font-size: 13px; color: #d4d4d8; }
`;
  const style = document.createElement("style");
  style.id = "cheetos-style";
  style.textContent = css;
  document.head.appendChild(style);
}

function buildRow(def: CheatDef, api: CheatApi): HTMLElement {
  const row = document.createElement("div");
  row.className = "cheetos-row";

  const btn = document.createElement("button");
  btn.className = "cheetos-btn";
  btn.textContent = def.label;
  btn.title = def.description ?? def.label;
  if (def.kind === "toggle" && ACTIVE[def.id]) btn.classList.add("active");
  row.appendChild(btn);

  const inputs: HTMLInputElement[] = [];
  for (const input of def.inputs ?? []) {
    const el = document.createElement("input");
    el.className = "cheetos-input";
    el.type = input.type === "number" ? "number" : "text";
    el.placeholder = input.placeholder ?? input.label;
    el.value = input.defaultValue ?? "";
    row.appendChild(el);
    inputs.push(el);
  }

  btn.addEventListener("click", () => {
    const args: Record<string, string> = {};
    for (let i = 0; i < (def.inputs ?? []).length; i++) {
      args[def.inputs![i].name] = inputs[i].value;
    }

    try {
      if (def.kind === "toggle") {
        const handle = ACTIVE[def.id];
        if (handle) {
          handle.stop();
          delete ACTIVE[def.id];
          btn.classList.remove("active");
          return;
        }
        const started = def.run(api, args);
        if (started) {
          ACTIVE[def.id] = started;
          btn.classList.add("active");
        }
        return;
      }
      def.run(api, args);
    } catch (err) {
      api.log(def.label + " failed: " + (err as Error).message);
    }
  });

  return row;
}

function groupsOf(cheats: CheatDef[]): Map<string, CheatDef[]> {
  const groups = new Map<string, CheatDef[]>();
  for (const cheat of cheats) {
    if (!groups.has(cheat.group)) groups.set(cheat.group, []);
    groups.get(cheat.group)!.push(cheat);
  }
  return groups;
}

function buildGroup(name: string, defs: CheatDef[], api: CheatApi): HTMLElement {
  const group = document.createElement("div");
  group.className = "cheetos-group";
  const title = document.createElement("div");
  title.className = "cheetos-group-title";
  title.textContent = name;
  group.appendChild(title);
  for (const def of defs) group.appendChild(buildRow(def, api));
  return group;
}

function buildGlobalNote(ctx: AppContext): HTMLElement {
  const note = document.createElement("div");
  note.className = "cheetos-note";
  if (ctx.kind === "game") {
    note.textContent = "In " + ctx.modeLabel + ". Global cheats work in every mode.";
  } else if (ctx.kind === "lobby") {
    note.textContent = "In a lobby. Toggle cheats now — they engage automatically when the game starts.";
  } else {
    note.textContent = "On the dashboard. Toggle cheats now — they engage automatically when a game starts.";
  }
  return note;
}

function buildModeNote(ctx: AppContext, mode: ModeDef): HTMLElement {
  const note = document.createElement("div");
  note.className = "cheetos-note";
  if (ctx.kind === "game" && ctx.modeId === mode.id) {
    note.textContent = ctx.live
      ? "Live " + mode.label + " game detected — cheats are ready."
      : "In the " + mode.label + " lobby. Toggles arm now and engage when the host starts.";
  } else {
    note.textContent =
      "Not in " + mode.label + " yet. Arm toggles here — they engage automatically once the game starts.";
  }
  return note;
}

function buildTabContent(ctx: AppContext, api: CheatApi, onStopAll: () => void): HTMLElement {
  const wrap = document.createElement("div");

  if (selectedTab === "global") {
    wrap.appendChild(buildGlobalNote(ctx));
    for (const [name, defs] of groupsOf(globalCheats)) wrap.appendChild(buildGroup(name, defs, api));
    wrap.appendChild(buildSettingsGroup());
    const row = document.createElement("div");
    row.className = "cheetos-row";
    const stop = document.createElement("button");
    stop.className = "cheetos-btn warn";
    stop.textContent = "Stop All Cheats";
    stop.title = "Stops every running toggle.";
    stop.addEventListener("click", () => {
      stopAllToggles();
      onStopAll();
    });
    row.appendChild(stop);
    wrap.appendChild(row);
    return wrap;
  }

  const mode = MODES.find((m) => m.id === selectedTab);
  if (!mode) return wrap;
  wrap.appendChild(buildModeNote(ctx, mode));
  for (const [name, defs] of groupsOf(mode.cheats)) wrap.appendChild(buildGroup(name, defs, api));
  return wrap;
}

function clampInt(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function settingToggle(
  label: string,
  tip: string,
  read: () => boolean,
  write: (on: boolean) => void,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "cheetos-setting-row";
  const lab = document.createElement("label");
  lab.textContent = label;
  lab.title = tip;
  const btn = document.createElement("button");
  btn.className = "cheetos-btn";
  btn.style.minWidth = "64px";
  btn.style.flex = "0 0 64px";
  btn.textContent = read() ? "On" : "Off";
  if (read()) btn.classList.add("active");
  btn.addEventListener("click", () => {
    const next = !read();
    write(next);
    btn.textContent = next ? "On" : "Off";
    btn.classList.toggle("active", next);
  });
  row.appendChild(lab);
  row.appendChild(btn);
  return row;
}

function settingNumber(label: string, read: () => number, write: (v: number) => void): HTMLElement {
  const row = document.createElement("div");
  row.className = "cheetos-setting-row";
  const lab = document.createElement("label");
  lab.textContent = label;
  const input = document.createElement("input");
  input.className = "cheetos-input";
  input.type = "number";
  input.value = String(read());
  input.addEventListener("change", () => {
    write(parseInt(input.value, 10) || 0);
    input.value = String(read());
  });
  row.appendChild(lab);
  row.appendChild(input);
  return row;
}

function buildSettingsGroup(): HTMLElement {
  const group = document.createElement("div");
  group.className = "cheetos-group";

  const title = document.createElement("div");
  title.className = "cheetos-group-title";
  title.textContent = "Humanizer";
  group.appendChild(title);

  group.appendChild(
    settingToggle(
      "Human Delays",
      "Pause before answering like a real player.",
      () => getSettings().delays,
      (on) => updateSettings({ delays: on }),
    ),
  );
  group.appendChild(
    settingToggle(
      "Typing Sim",
      "Type written answers out instead of submitting instantly.",
      () => getSettings().typing,
      (on) => updateSettings({ typing: on }),
    ),
  );
  group.appendChild(
    settingNumber("Min Delay (ms)", () => getSettings().minDelay, (v) => updateSettings({ minDelay: clampInt(v, 0, 10000) })),
  );
  group.appendChild(
    settingNumber("Max Delay (ms)", () => getSettings().maxDelay, (v) => updateSettings({ maxDelay: clampInt(v, 0, 10000) })),
  );
  group.appendChild(
    settingNumber("Accuracy (%)", () => getSettings().accuracy, (v) => updateSettings({ accuracy: clampInt(v, 1, 100) })),
  );

  const hint = document.createElement("div");
  hint.className = "cheetos-hint";
  hint.textContent =
    "Lower accuracy makes Auto Answer miss occasionally so streaks stay believable. 100% never misses.";
  group.appendChild(hint);

  return group;
}

function makeDraggable(panel: HTMLElement, handle: HTMLElement): void {
  let dragging = false;
  let offX = 0;
  let offY = 0;

  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    const rect = panel.getBoundingClientRect();
    offX = e.clientX - rect.left;
    offY = e.clientY - rect.top;
    handle.style.cursor = "grabbing";
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    panel.style.right = "auto";
    panel.style.left = e.clientX - offX + "px";
    panel.style.top = e.clientY - offY + "px";
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
    handle.style.cursor = "grab";
  });
}

export interface PanelHandle {
  root: HTMLElement;
  update(ctx: AppContext): void;
  reattach(): void;
}

export function mountPanel(api: CheatApi): PanelHandle {
  ensureStyle();

  const root = document.createElement("div");
  root.id = "cheetos-root";

  const toggle = document.createElement("button");
  toggle.id = "cheetos-toggle";
  toggle.textContent = "Cheetos";
  root.appendChild(toggle);

  const panel = document.createElement("div");
  panel.id = "cheetos-panel";

  const head = document.createElement("div");
  head.id = "cheetos-head";
  const title = document.createElement("span");
  title.className = "title";
  title.textContent = "Blooket Cheetos";
  const status = document.createElement("span");
  status.id = "cheetos-status";
  const close = document.createElement("button");
  close.id = "cheetos-close";
  close.textContent = "\u00d7";
  head.appendChild(title);
  head.appendChild(status);
  head.appendChild(close);
  panel.appendChild(head);

  const tabs = document.createElement("div");
  tabs.id = "cheetos-tabs";
  panel.appendChild(tabs);

  const body = document.createElement("div");
  body.id = "cheetos-body";
  panel.appendChild(body);
  root.appendChild(panel);

  let ctx: AppContext = { kind: "other", modeId: null, modeLabel: null, live: false, signature: "" };

  const render = () => {
    status.className = "";
    if (ctx.kind === "other") {
      status.textContent = "off-site";
    } else if (ctx.kind === "game" && ctx.modeLabel) {
      status.textContent = ctx.live ? ctx.modeLabel + " \u00b7 live" : ctx.modeLabel + " \u00b7 waiting";
      status.className = ctx.live ? "live" : "waiting";
    } else if (ctx.kind === "lobby") {
      status.textContent = "Lobby";
      status.className = "waiting";
    } else {
      status.textContent = "Dashboard";
      status.className = "waiting";
    }

    tabs.replaceChildren();
    const tabDefs = [{ id: "global", label: "General" }, ...MODES.map((m) => ({ id: m.id, label: m.label }))];
    for (const t of tabDefs) {
      const btn = document.createElement("button");
      btn.className = "cheetos-tab";
      if (t.id === selectedTab) btn.classList.add("active");
      if (ctx.kind === "game" && ctx.live && ctx.modeId === t.id) btn.classList.add("live");
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        selectedTab = t.id;
        render();
      });
      tabs.appendChild(btn);
    }

    body.replaceChildren();
    if (ctx.kind === "other") {
      const note = document.createElement("div");
      note.className = "cheetos-note";
      note.textContent = "Run the bookmark on a blooket.com page \u2014 dashboard, join screen, or a live game.";
      body.appendChild(note);
      return;
    }
    body.appendChild(buildTabContent(ctx, api, render));
  };

  const update = (next: AppContext) => {
    if (next.kind === "game" && next.live && !prevLive && next.modeId) {
      selectedTab = next.modeId;
    }
    prevLive = next.kind === "game" && next.live;
    ctx = next;
    render();
  };

  toggle.addEventListener("click", () => panel.classList.toggle("hidden"));
  close.addEventListener("click", () => panel.classList.add("hidden"));

  document.body.appendChild(root);
  makeDraggable(panel, head);

  return {
    root,
    update,
    reattach: () => {
      if (!document.body.contains(root)) document.body.appendChild(root);
    },
  };
}
