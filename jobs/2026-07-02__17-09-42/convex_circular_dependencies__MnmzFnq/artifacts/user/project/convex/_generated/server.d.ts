export * from "convex/server";
export declare const query: <T>(obj: { args?: any; handler: (ctx: any) => Promise<T> }) => ((ctx: any) => Promise<T>);
