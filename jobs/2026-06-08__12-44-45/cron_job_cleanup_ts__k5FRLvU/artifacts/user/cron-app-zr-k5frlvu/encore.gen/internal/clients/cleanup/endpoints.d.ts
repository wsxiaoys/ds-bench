import { CallOpts } from "encore.dev/api";

type Parameters<T> = T extends (...args: infer P) => unknown ? P : never;
type WithCallOpts<T extends (...args: any) => any> = (
  ...args: [...Parameters<T>, opts?: CallOpts]
) => ReturnType<T>;

import { createRecord as createRecord_handler } from "../../../../cleanup/cleanup.js";
type createRecord_Type = WithCallOpts<typeof createRecord_handler>;
declare const createRecord: createRecord_Type;
export { createRecord };

import { cleanup as cleanup_handler } from "../../../../cleanup/cleanup.js";
type cleanup_Type = WithCallOpts<typeof cleanup_handler>;
declare const cleanup: cleanup_Type;
export { cleanup };


export class Client {
  private constructor();

  readonly createRecord: createRecord_Type;
  readonly cleanup: cleanup_Type;
}

export declare function ref(): Client;
