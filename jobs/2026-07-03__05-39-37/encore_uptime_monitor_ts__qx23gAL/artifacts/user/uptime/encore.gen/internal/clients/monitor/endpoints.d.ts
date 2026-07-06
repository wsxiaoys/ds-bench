import { CallOpts } from "encore.dev/api";

type Parameters<T> = T extends (...args: infer P) => unknown ? P : never;
type WithCallOpts<T extends (...args: any) => any> = (
  ...args: [...Parameters<T>, opts?: CallOpts]
) => ReturnType<T>;

import { addSite as addSite_handler } from "../../../../monitor/monitor.js";
type addSite_Type = WithCallOpts<typeof addSite_handler>;
declare const addSite: addSite_Type;
export { addSite };

import { listSites as listSites_handler } from "../../../../monitor/monitor.js";
type listSites_Type = WithCallOpts<typeof listSites_handler>;
declare const listSites: listSites_Type;
export { listSites };

import { checkAll as checkAll_handler } from "../../../../monitor/monitor.js";
type checkAll_Type = WithCallOpts<typeof checkAll_handler>;
declare const checkAll: checkAll_Type;
export { checkAll };


export class Client {
  private constructor();

  readonly addSite: addSite_Type;
  readonly listSites: listSites_Type;
  readonly checkAll: checkAll_Type;
}

export declare function ref(): Client;
