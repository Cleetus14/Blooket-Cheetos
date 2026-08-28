export interface Question {
  qType?: string;
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
  interval(fn: () => void, ms: number): ToggleHandle;
  log(msg: string): void;
}

export interface CheatDef {
  id: string;
  label: string;
  description?: string;
  group: string;
  kind: CheatKind;
  /** Renders the button red as a "destructive / affects others" warning. */
  warn?: boolean;
  inputs?: CheatInput[];
  run(api: CheatApi, args: Record<string, string>): ToggleHandle | void;
}
