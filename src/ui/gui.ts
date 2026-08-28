import type { CheatApi, CheatDef, ToggleHandle } from "../types";
import type { AppContext } from "../core/context";
import { MODES, type ModeDef } from "../modes";
import { globalCheats } from "../modes/global";
import { getSettings, updateSettings } from "../core/settings";
import { allDocuments } from "../core/state";
import { VERSION } from "../version";

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

function sty<T extends HTMLElement>(el: T, props: Record<string, string>): T {
  for (const key of Object.keys(props)) {
    (el.style as any)[key] = props[key];
  }
  return el;
}

const C = {
  bg: "#18181b",
  bg2: "#202024",
  bg3: "#27272a",
  border: "#3f3f46",
  text: "#e4e4e7",
  muted: "#a1a1aa",
  faint: "#71717a",
  accent: "#7c3aed",
  green: "#16a34a",
  red: "#b91c1c",
  gold: "#facc15",
  purple: "#a78bfa",
  font: "Segoe UI, system-ui, -apple-system, sans-serif",
};

function noteEl(text: string): HTMLElement {
  const el = sty(document.createElement("div"), {
    padding: "10px 12px",
    fontSize: "12.5px",
    color: C.muted,
    lineHeight: "1.5",
    background: C.bg2,
    borderRadius: "8px",
    marginBottom: "8px",
  });
  el.textContent = text;
  return el;
}

function hintEl(text: string): HTMLElement {
  const el = sty(document.createElement("div"), {
    padding: "4px 12px 10px",
    fontSize: "11px",
    color: C.faint,
    lineHeight: "1.5",
  });
  el.textContent = text;
  return el;
}

function groupEl(name: string): HTMLElement {
  const group = sty(document.createElement("div"), { margin: "10px 0 4px" });
  const title = sty(document.createElement("div"), {
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: ".08em",
    textTransform: "uppercase",
    color: C.purple,
    marginBottom: "6px",
  });
  title.textContent = name;
  group.appendChild(title);
  return group;
}

function rowEl(): HTMLElement {
  return sty(document.createElement("div"), {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "6px",
    flexWrap: "wrap",
  });
}

function inputEl(): HTMLInputElement {
  return sty(document.createElement("input"), {
    width: "84px",
    background: C.bg3,
    color: "#fafafa",
    border: "1px solid #52525b",
    borderRadius: "6px",
    padding: "6px 7px",
    fontSize: "12px",
    fontFamily: C.font,
  });
}

function btnEl(active = false, warn = false): HTMLButtonElement {
  const el = sty(document.createElement("button"), {
    flex: "1 1 auto",
    minWidth: "120px",
    textAlign: "left",
    background: warn ? C.red : active ? C.green : C.border,
    color: "#fafafa",
    border: "none",
    borderRadius: "8px",
    padding: "7px 10px",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: C.font,
  });
  if (active) el.classList.add("active");
  if (warn) el.dataset.warn = "1";
  el.addEventListener("mouseenter", () => {
    if (!el.classList.contains("active")) el.style.background = warn ? "#7f1d1d" : "#52525b";
  });
  el.addEventListener("mouseleave", () => {
    if (!el.classList.contains("active")) el.style.background = warn ? C.red : C.border;
  });
  return el;
}

function setBtnActive(el: HTMLButtonElement, active: boolean): void {
  el.classList.toggle("active", active);
  el.style.background = active ? C.green : el.dataset.warn ? C.red : C.border;
}

function buildRow(def: CheatDef, api: CheatApi): HTMLElement {
  const row = rowEl();

  const btn = btnEl(def.kind === "toggle" && !!ACTIVE[def.id], def.warn);
  btn.textContent = def.label;
  btn.title = def.description ?? def.label;
  row.appendChild(btn);

  const inputs: HTMLInputElement[] = [];
  for (const input of def.inputs ?? []) {
    const el = inputEl();
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
          setBtnActive(btn, false);
          return;
        }
        const started = def.run(api, args);
        if (started) {
          ACTIVE[def.id] = started;
          setBtnActive(btn, true);
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
  const group = groupEl(name);
  for (const def of defs) group.appendChild(buildRow(def, api));
  return group;
}

function buildGlobalNote(ctx: AppContext): HTMLElement {
  if (ctx.kind === "game") {
    return noteEl("In " + ctx.modeLabel + ". Global cheats work in every mode.");
  }
  if (ctx.kind === "lobby") {
    return noteEl("In a lobby. Toggle cheats now — they engage automatically when the game starts.");
  }
  return noteEl("On the dashboard. Toggle cheats now — they engage automatically when a game starts.");
}

function buildModeNote(ctx: AppContext, mode: ModeDef): HTMLElement {
  if (ctx.kind === "game" && ctx.modeId === mode.id) {
    return noteEl(
      ctx.live
        ? "Live " + mode.label + " game detected — cheats are ready."
        : "In the " + mode.label + " lobby. Toggles arm now and engage when the host starts.",
    );
  }
  return noteEl(
    "Not in " + mode.label + " yet. Arm toggles here — they engage automatically once the game starts.",
  );
}

function buildTabContent(ctx: AppContext, api: CheatApi, onStopAll: () => void): HTMLElement {
  const wrap = document.createElement("div");

  if (selectedTab === "global") {
    wrap.appendChild(buildGlobalNote(ctx));
    for (const [name, defs] of groupsOf(globalCheats)) wrap.appendChild(buildGroup(name, defs, api));
    wrap.appendChild(buildSettingsGroup());
    const row = rowEl();
    const stop = btnEl(false, true);
    stop.textContent = "Stop All Cheats";
    stop.title = "Stops every running toggle.";
    stop.style.textAlign = "center";
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

function settingRow(): HTMLElement {
  return sty(document.createElement("div"), {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    padding: "5px 0",
  });
}

function settingToggle(
  label: string,
  tip: string,
  read: () => boolean,
  write: (on: boolean) => void,
): HTMLElement {
  const row = settingRow();
  const lab = sty(document.createElement("label"), { fontSize: "13px", color: "#d4d4d8" });
  lab.textContent = label;
  lab.title = tip;
  const btn = btnEl(read());
  btn.style.flex = "0 0 64px";
  btn.style.minWidth = "64px";
  btn.textContent = read() ? "On" : "Off";
  btn.addEventListener("click", () => {
    const next = !read();
    write(next);
    btn.textContent = next ? "On" : "Off";
    setBtnActive(btn, next);
  });
  row.appendChild(lab);
  row.appendChild(btn);
  return row;
}

function settingNumber(label: string, read: () => number, write: (v: number) => void): HTMLElement {
  const row = settingRow();
  const lab = sty(document.createElement("label"), { fontSize: "13px", color: "#d4d4d8" });
  lab.textContent = label;
  const input = inputEl();
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
  const group = groupEl("Humanizer");

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

  group.appendChild(
    hintEl("Lower accuracy makes Auto Answer miss occasionally so streaks stay believable. 100% never misses."),
  );

  return group;
}

function makeDraggable(panel: HTMLElement, handle: HTMLElement): void {
  let dragging = false;
  let offX = 0;
  let offY = 0;
  let pointerId: number | null = null;

  handle.style.touchAction = "none";

  const start = (x: number, y: number, id: number) => {
    dragging = true;
    pointerId = id;
    const rect = panel.getBoundingClientRect();
    offX = x - rect.left;
    offY = y - rect.top;
    handle.style.cursor = "grabbing";
  };

  const move = (x: number, y: number) => {
    if (!dragging) return;
    panel.style.right = "auto";
    panel.style.left = x - offX + "px";
    panel.style.top = y - offY + "px";
  };

  const end = () => {
    dragging = false;
    pointerId = null;
    handle.style.cursor = "grab";
  };

  const ignoreDrag = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest("button");

  if (window.PointerEvent) {
    handle.addEventListener("pointerdown", (e) => {
      if (ignoreDrag(e.target)) return;
      start(e.clientX, e.clientY, e.pointerId);
      handle.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });
    handle.addEventListener("pointermove", (e) => {
      if (e.pointerId !== pointerId) return;
      move(e.clientX, e.clientY);
    });
    handle.addEventListener("pointerup", (e) => {
      if (e.pointerId !== pointerId) return;
      end();
    });
    handle.addEventListener("pointercancel", (e) => {
      if (e.pointerId !== pointerId) return;
      end();
    });
    return;
  }

  handle.addEventListener("mousedown", (e) => {
    if (ignoreDrag(e.target)) return;
    start(e.clientX, e.clientY, 0);
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    move(e.clientX, e.clientY);
  });
  window.addEventListener("mouseup", () => end());
  handle.addEventListener(
    "touchstart",
    (e) => {
      if (ignoreDrag(e.target)) return;
      const t = e.touches[0];
      if (t) start(t.clientX, t.clientY, 1);
    },
    { passive: true },
  );
  handle.addEventListener(
    "touchmove",
    (e) => {
      const t = e.touches[0];
      if (t) move(t.clientX, t.clientY);
    },
    { passive: true },
  );
  handle.addEventListener("touchend", () => end());
}

export interface PanelHandle {
  root: HTMLElement;
  update(ctx: AppContext): void;
  reattach(): void;
}

export function mountPanel(api: CheatApi): PanelHandle {
  const root = document.createElement("div");
  root.id = "cheetos-root";

  const toggle = sty(document.createElement("button"), {
    position: "fixed",
    right: "14px",
    bottom: "14px",
    zIndex: "2147483000",
    background: C.accent,
    color: "#fff",
    border: "none",
    borderRadius: "999px",
    padding: "10px 16px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "0 4px 14px rgba(0,0,0,.35)",
    fontFamily: C.font,
  });
  toggle.id = "cheetos-toggle";
  toggle.textContent = "Cheetos";
  root.appendChild(toggle);

  const panel = sty(document.createElement("div"), {
    position: "fixed",
    top: "12px",
    right: "12px",
    zIndex: "2147483001",
    width: "360px",
    maxHeight: "84vh",
    display: "flex",
    flexDirection: "column",
    background: C.bg,
    color: C.text,
    border: "1px solid " + C.border,
    borderRadius: "12px",
    boxShadow: "0 12px 32px rgba(0,0,0,.5)",
    overflow: "hidden",
    fontFamily: C.font,
    fontSize: "13px",
  });
  panel.id = "cheetos-panel";

  const head = sty(document.createElement("div"), {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    background: C.bg3,
    cursor: "grab",
    userSelect: "none",
  });
  head.id = "cheetos-head";

  const title = sty(document.createElement("span"), {
    fontWeight: "800",
    fontSize: "15px",
    color: C.gold,
    marginRight: "auto",
  });
  title.textContent = "Blooket Cheetos V" + VERSION;

  const status = sty(document.createElement("span"), {
    fontSize: "10px",
    fontWeight: "700",
    padding: "3px 8px",
    borderRadius: "999px",
    background: C.border,
    color: C.muted,
    whiteSpace: "nowrap",
  });
  status.id = "cheetos-status";
  status.style.cursor = "pointer";
  status.title = "Click to hide/show this panel";

  const close = sty(document.createElement("button"), {
    background: "none",
    border: "none",
    color: C.muted,
    fontSize: "18px",
    cursor: "pointer",
    padding: "0 4px",
    fontFamily: C.font,
  });
  close.id = "cheetos-close";
  close.textContent = "\u00d7";
  close.title = "Hide panel";

  head.appendChild(title);
  head.appendChild(status);
  head.appendChild(close);
  panel.appendChild(head);

  const tabs = sty(document.createElement("div"), {
    display: "flex",
    gap: "4px",
    overflowX: "auto",
    padding: "8px 10px",
    background: C.bg2,
    borderBottom: "1px solid " + C.border,
  });
  tabs.id = "cheetos-tabs";
  panel.appendChild(tabs);

  const body = sty(document.createElement("div"), {
    overflowY: "auto",
    padding: "8px 10px 12px",
    flex: "1 1 auto",
    minHeight: "0",
  });
  body.id = "cheetos-body";
  panel.appendChild(body);

  const footer = sty(document.createElement("div"), {
    padding: "6px 12px",
    fontSize: "11px",
    color: C.faint,
    borderTop: "1px solid " + C.border,
    background: C.bg2,
    textAlign: "center",
  });
  footer.textContent = "Ctrl+Shift+X (or Ctrl+Shift+E) hides/shows this panel";
  panel.appendChild(footer);

  root.appendChild(panel);

  const setHidden = (hidden: boolean) => {
    panel.style.display = hidden ? "none" : "flex";
  };
  const togglePanel = () => setHidden(panel.style.display !== "none");
  (window as any).__cheetosShow = () => setHidden(false);

  let ctx: AppContext = { kind: "other", modeId: null, modeLabel: null, live: false, signature: "" };

  const render = () => {
    status.style.background = C.border;
    status.style.color = C.muted;
    if (ctx.kind === "other") {
      status.textContent = "off-site";
    } else if (ctx.kind === "game" && ctx.modeLabel) {
      status.textContent = ctx.live ? ctx.modeLabel + " \u00b7 live" : ctx.modeLabel + " \u00b7 waiting";
      if (ctx.live) {
        status.style.background = "#14532d";
        status.style.color = "#86efac";
      } else {
        status.style.background = "#451a03";
        status.style.color = "#fcd34d";
      }
    } else if (ctx.kind === "lobby") {
      status.textContent = "Lobby";
      status.style.background = "#451a03";
      status.style.color = "#fcd34d";
    } else {
      status.textContent = "Dashboard";
      status.style.background = "#451a03";
      status.style.color = "#fcd34d";
    }

    tabs.replaceChildren();
    const tabDefs = [{ id: "global", label: "General" }, ...MODES.map((m) => ({ id: m.id, label: m.label }))];
    for (const t of tabDefs) {
      const btn = sty(document.createElement("button"), {
        flex: "0 0 auto",
        border: "1px solid transparent",
        background: "transparent",
        color: C.muted,
        fontSize: "12px",
        fontWeight: "700",
        padding: "5px 10px",
        borderRadius: "999px",
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontFamily: C.font,
      });
      const active = t.id === selectedTab;
      if (active) {
        btn.style.background = C.accent;
        btn.style.color = "#fff";
      }
      if (ctx.kind === "game" && ctx.live && ctx.modeId === t.id) {
        btn.style.borderColor = "#22c55e";
      }
      btn.textContent = t.label;
      btn.addEventListener("mouseenter", () => {
        if (!active) btn.style.background = "#2c2c31";
      });
      btn.addEventListener("mouseleave", () => {
        if (!active) {
          btn.style.background = "transparent";
          btn.style.color = C.muted;
        }
      });
      btn.addEventListener("click", () => {
        selectedTab = t.id;
        render();
      });
      tabs.appendChild(btn);
    }

    body.replaceChildren();
    if (ctx.kind === "other") {
      body.appendChild(noteEl("Run the bookmark on a blooket.com page \u2014 dashboard, join screen, or a live game."));
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

  toggle.addEventListener("click", togglePanel);
  close.addEventListener("click", () => setHidden(true));
  status.addEventListener("click", togglePanel);
  title.style.cursor = "pointer";
  title.title = "Click to hide/show this panel";
  title.addEventListener("click", togglePanel);

  // --- Hotkey: bind on every same-origin document (top + iframes), on
  // window / document / body, in both capture and bubble phases, so Blooket
  // or an iframe with focus can never swallow Ctrl+Shift+X / Ctrl+Shift+E.
  const hotkeyTargets = new WeakSet<object>();
  let lastHotkey = 0;
  const onHotkey = (e: KeyboardEvent) => {
    if (!(e.ctrlKey && e.shiftKey)) return;
    const key = (e.code || e.key || "").toLowerCase();
    const isMod = key === "shift" || key === "control" || key === "alt" || key === "meta";
    const isToggle = key === "keyx" || key === "x" || key === "keye" || key === "e";
    if (!isToggle && !isMod) {
      console.log(
        "%c[Cheetos]%c hotkey: ctrl+shift+" + key,
        "color:#facc15",
        "color:inherit",
      );
    }
    if (!isToggle) return;
    if (e.repeat) return;
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastHotkey < 120) return;
    lastHotkey = now;
    togglePanel();
    console.log(
      "%c[Cheetos]%c panel " + (panel.style.display === "none" ? "hidden" : "shown"),
      "color:#facc15",
      "color:inherit",
    );
  };
  const bindHotkeys = (): void => {
    let docs: Document[];
    try {
      docs = allDocuments();
    } catch {
      docs = [document];
    }
    for (const d of docs) {
      const targets: Array<EventTarget | null> = [window, d.defaultView, d, d.documentElement, d.body];
      for (const t of targets) {
        if (!t || hotkeyTargets.has(t)) continue;
        hotkeyTargets.add(t);
        (t as EventTarget).addEventListener("keydown", onHotkey as EventListener, true);
        (t as EventTarget).addEventListener("keydown", onHotkey as EventListener, false);
      }
    }
  };
  bindHotkeys();
  // Blooket may create new same-origin iframes as you navigate modes; keep
  // re-binding so a freshly focused frame can't swallow the hotkey.
  setInterval(bindHotkeys, 2000);

  document.body.appendChild(root);
  makeDraggable(panel, head);

  return {
    root,
    update,
    reattach: () => {
      if (!document.body.contains(root)) document.body.appendChild(root);
      bindHotkeys();
    },
  };
}
