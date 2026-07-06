import { CallOpts } from "encore.dev/api";

type Parameters<T> = T extends (...args: infer P) => unknown ? P : never;
type WithCallOpts<T extends (...args: any) => any> = (
  ...args: [...Parameters<T>, opts?: CallOpts]
) => ReturnType<T>;

import { getDashboard as getDashboard_handler } from "../../../../src/dashboard.js";
type getDashboard_Type = WithCallOpts<typeof getDashboard_handler>;
declare const getDashboard: getDashboard_Type;
export { getDashboard };


export class Client {
  private constructor();

  readonly getDashboard: getDashboard_Type;
}

export declare function ref(): Client;
