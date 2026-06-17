import { CallOpts } from "encore.dev/api";

type Parameters<T> = T extends (...args: infer P) => unknown ? P : never;
type WithCallOpts<T extends (...args: any) => any> = (
  ...args: [...Parameters<T>, opts?: CallOpts]
) => ReturnType<T>;

import { dashboard as dashboard_handler } from "../../../../encore.service.js";
type dashboard_Type = WithCallOpts<typeof dashboard_handler>;
declare const dashboard: dashboard_Type;
export { dashboard };


export class Client {
  private constructor();

  readonly dashboard: dashboard_Type;
}

export declare function ref(): Client;
