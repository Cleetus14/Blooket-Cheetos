export interface CheetosSettings {
  delays: boolean;
  typing: boolean;
  minDelay: number;
  maxDelay: number;
  accuracy: number;
}

const KEY = "cheetos.settings";
const DEFAULTS: CheetosSettings = {
  delays: true,
  typing: true,
  minDelay: 350,
  maxDelay: 950,
  accuracy: 100,
};

let current: CheetosSettings = load();

function load(): CheetosSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getSettings(): CheetosSettings {
  return current;
}

export function updateSettings(patch: Partial<CheetosSettings>): CheetosSettings {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  return current;
}
