import type { AppContext } from "../src/worker";

declare module "rwsdk/worker" {
  interface DefaultAppContext extends AppContext {}

  // App is the type of your defineApp export in src/worker.tsx
  export type App = typeof import("../src/worker").default;
}

declare module "rwsdk/server" {
  export function serverAction<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>
  ): (...args: TArgs) => Promise<TResult>;
  export function serverQuery<TArgs extends any[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>
  ): (...args: TArgs) => Promise<TResult>;
}

declare module "rwsdk/use-synced-state/client" {
  export function useSyncedState<T>(
    initialValue: T,
    key: string,
    roomId?: string
  ): [T, (value: T | ((prev: T) => T)) => void];
}
