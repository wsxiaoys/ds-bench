export interface Subscriber {
  id: string;
  send: (data: string) => Promise<void>;
  close: () => void;
}

export interface SharedState {
  version: number;
  text: string;
  subscribers: Map<string, Subscriber>;
}

const GLOBAL_KEY = Symbol.for("qwik-notepad-state");

if (!(globalThis as any)[GLOBAL_KEY]) {
  (globalThis as any)[GLOBAL_KEY] = {
    version: 0,
    text: "",
    subscribers: new Map(),
  };
}

export const state = (globalThis as any)[GLOBAL_KEY] as SharedState;
