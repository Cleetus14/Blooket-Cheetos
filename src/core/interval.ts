import type { ToggleHandle } from "../types";

export function makeInterval(fn: () => void, ms: number): ToggleHandle {
  let id: number | null = window.setInterval(() => {
    try {
      fn();
    } catch {
      /* swallow per-tick errors so one bad frame never kills the loop */
    }
  }, ms);

  return {
    running: () => id !== null,
    stop() {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    },
  };
}
