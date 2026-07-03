import { ParsedInputNode, ParseReferences } from "@src/parse/parseNodeTypes";
import { AnyZodObject, ZodBrandedDef } from "zod";
export declare function parseZodBrandedDef(def: ZodBrandedDef<AnyZodObject>, refs: ParseReferences): ParsedInputNode;
