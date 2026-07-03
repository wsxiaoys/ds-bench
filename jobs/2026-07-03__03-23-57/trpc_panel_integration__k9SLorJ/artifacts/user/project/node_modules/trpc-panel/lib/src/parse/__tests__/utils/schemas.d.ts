import { ParsedInputNode } from "@src/parse/parseNodeTypes";
import { ZodSchema } from "zod";
export declare const testEnumValues: readonly ["a", "b", "c"];
export declare const testSchemas: {
    schema: ZodSchema;
    parsed: ParsedInputNode;
}[];
