import { type MiddlewareConfigFn } from "wasp/server";
import { type Status, type Echo } from "wasp/server/api";
export declare const getStatus: Status;
export declare const echoHandler: Echo;
export declare const echoMiddleware: MiddlewareConfigFn;
