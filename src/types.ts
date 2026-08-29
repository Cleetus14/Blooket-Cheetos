export interface Question {
  qType?: string;
  question?: string;
  answers: string[];
  correctAnswers: string[];
}

export interface CheatInput {
  name: string;
  label: string;
  type?: "number" | "text";
  placeholder?: string;
  defaultValue?: string;
}

export type CheatKind = "action" | "toggle";

export interface ToggleHandle {
  running(): boolean;
  stop(): void;
}

export interface CheatApi {
  node(): any;
  state(): Record<string, any>;
  client(): Record<string, any>;
  setState(patch: Record<string, any>): void;
  setVal(path: string, val: unknown): void;
  getVal(path: string, cb: (val: any) => void): void;
  question(): Question | null;
  answerCurrent(): boolean;
  answerIndex(idx: number): boolean;
  answerTyping(): boolean;
  advance(): boolean;
  kickPlayer(name: string): string[];
  interval(fn: () => void, ms: number): ToggleHandle;
  runCheat(id: string, args?: Record<string, string>): unknown;
  test(): void;
  log(msg: string): void;
}

export interface CheatDef {
  id: string;
  label: string;
  description?: string;
  group: string;
  kind: CheatKind;
  /** Destructive action (affects other players). */
  warn?: boolean;
  inputs?: CheatInput[];
  run(api: CheatApi, args: Record<string, string>): ToggleHandle | void;
}
