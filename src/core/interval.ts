import type { ToggleHandle } from "../types";

export function makeInterval(fn: () => void, ms: number): ToggleHandle {
  let id: number | null = window.setInterval(() => {
    try {
      fn();
    } catch {
      /* ignore */
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
