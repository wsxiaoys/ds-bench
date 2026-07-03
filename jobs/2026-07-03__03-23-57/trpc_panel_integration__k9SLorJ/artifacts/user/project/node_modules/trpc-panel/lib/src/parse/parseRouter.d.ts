import { Router as TRPCRouter } from "@trpc/server";
import { zodToJsonSchema } from "zod-to-json-schema";
import { ParsedProcedure } from "./parseProcedure";
export type JSON7SchemaType = ReturnType<typeof zodToJsonSchema>;
export type ProcedureType = "query" | "mutation" | "subscription";
export type ParsedRouterChildren = {
    [key: string]: ParsedRouter | ParsedProcedure;
};
export type ParsedRouter = {
    children: ParsedRouterChildren;
    path: string[];
    nodeType: "router";
};
export type ParseRouterRefs = {
    path: string[];
};
export type TrpcPanelExtraOptions = {
    logFailedProcedureParse?: boolean;
    transformer?: "superjson";
};
export declare function parseRouterWithOptions(router: TRPCRouter<any>, parseRouterOptions: TrpcPanelExtraOptions): ParsedRouter;
