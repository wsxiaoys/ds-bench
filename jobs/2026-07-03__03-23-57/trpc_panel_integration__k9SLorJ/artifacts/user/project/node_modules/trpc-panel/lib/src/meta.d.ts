import { z } from "zod";
export declare const TRPCPanelMetaSchema: z.ZodObject<{
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description?: string | undefined;
}, {
    description?: string | undefined;
}>;
export type TRPCPanelMeta = z.infer<typeof TRPCPanelMetaSchema>;
