import { z } from "zod";
declare const ZodObjectSchema: z.ZodObject<{}, "strip", z.ZodTypeAny, {}, {}>;
export declare function isZodObject(obj: unknown): obj is z.infer<typeof ZodObjectSchema>;
declare const SharedProcedureDefPropertiesSchema: z.ZodObject<{
    inputs: z.ZodArray<z.ZodUnknown, "many">;
    meta: z.ZodOptional<z.ZodObject<{
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description?: string | undefined;
    }, {
        description?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    inputs: unknown[];
    meta?: {
        description?: string | undefined;
    } | undefined;
}, {
    inputs: unknown[];
    meta?: {
        description?: string | undefined;
    } | undefined;
}>;
declare const QueryDefSchema: z.ZodObject<{
    inputs: z.ZodArray<z.ZodUnknown, "many">;
    meta: z.ZodOptional<z.ZodObject<{
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description?: string | undefined;
    }, {
        description?: string | undefined;
    }>>;
    query: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    inputs: unknown[];
    query: true;
    meta?: {
        description?: string | undefined;
    } | undefined;
}, {
    inputs: unknown[];
    query: true;
    meta?: {
        description?: string | undefined;
    } | undefined;
}>;
export declare function isQueryDef(obj: unknown): obj is QueryDef;
type QueryDef = z.infer<typeof QueryDefSchema>;
declare const MutationDefSchema: z.ZodObject<{
    inputs: z.ZodArray<z.ZodUnknown, "many">;
    meta: z.ZodOptional<z.ZodObject<{
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description?: string | undefined;
    }, {
        description?: string | undefined;
    }>>;
    mutation: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    inputs: unknown[];
    mutation: true;
    meta?: {
        description?: string | undefined;
    } | undefined;
}, {
    inputs: unknown[];
    mutation: true;
    meta?: {
        description?: string | undefined;
    } | undefined;
}>;
export declare function isMutationDef(obj: unknown): obj is MutationDef;
export type MutationDef = z.infer<typeof MutationDefSchema>;
declare const SubscriptionDefSchema: z.ZodObject<{
    inputs: z.ZodArray<z.ZodUnknown, "many">;
    meta: z.ZodOptional<z.ZodObject<{
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description?: string | undefined;
    }, {
        description?: string | undefined;
    }>>;
    subscription: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    inputs: unknown[];
    subscription: true;
    meta?: {
        description?: string | undefined;
    } | undefined;
}, {
    inputs: unknown[];
    subscription: true;
    meta?: {
        description?: string | undefined;
    } | undefined;
}>;
type SubscriptionDef = z.infer<typeof SubscriptionDefSchema>;
export declare function isSubscriptionDef(obj: unknown): obj is SubscriptionDef;
export declare const ProcedureDefSchema: z.ZodUnion<[z.ZodUnion<[z.ZodObject<{
    inputs: z.ZodArray<z.ZodUnknown, "many">;
    meta: z.ZodOptional<z.ZodObject<{
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description?: string | undefined;
    }, {
        description?: string | undefined;
    }>>;
    query: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    inputs: unknown[];
    query: true;
    meta?: {
        description?: string | undefined;
    } | undefined;
}, {
    inputs: unknown[];
    query: true;
    meta?: {
        description?: string | undefined;
    } | undefined;
}>, z.ZodObject<{
    inputs: z.ZodArray<z.ZodUnknown, "many">;
    meta: z.ZodOptional<z.ZodObject<{
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description?: string | undefined;
    }, {
        description?: string | undefined;
    }>>;
    mutation: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    inputs: unknown[];
    mutation: true;
    meta?: {
        description?: string | undefined;
    } | undefined;
}, {
    inputs: unknown[];
    mutation: true;
    meta?: {
        description?: string | undefined;
    } | undefined;
}>]>, z.ZodObject<{
    inputs: z.ZodArray<z.ZodUnknown, "many">;
    meta: z.ZodOptional<z.ZodObject<{
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description?: string | undefined;
    }, {
        description?: string | undefined;
    }>>;
    subscription: z.ZodLiteral<true>;
}, "strip", z.ZodTypeAny, {
    inputs: unknown[];
    subscription: true;
    meta?: {
        description?: string | undefined;
    } | undefined;
}, {
    inputs: unknown[];
    subscription: true;
    meta?: {
        description?: string | undefined;
    } | undefined;
}>]>;
export type ProcedureDefSharedProperties = z.infer<typeof SharedProcedureDefPropertiesSchema>;
export type RouterDef = {
    router: true;
    procedures: Record<string, RouterOrProcedure>;
};
export type Router = {
    _def: RouterDef;
} & {
    [key: string]: Router | Procedure;
};
export declare function isRouter(obj: unknown): obj is Router;
declare const ProcedureSchema: z.ZodObject<{
    _def: z.ZodUnion<[z.ZodUnion<[z.ZodObject<{
        inputs: z.ZodArray<z.ZodUnknown, "many">;
        meta: z.ZodOptional<z.ZodObject<{
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            description?: string | undefined;
        }, {
            description?: string | undefined;
        }>>;
        query: z.ZodLiteral<true>;
    }, "strip", z.ZodTypeAny, {
        inputs: unknown[];
        query: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    }, {
        inputs: unknown[];
        query: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    }>, z.ZodObject<{
        inputs: z.ZodArray<z.ZodUnknown, "many">;
        meta: z.ZodOptional<z.ZodObject<{
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            description?: string | undefined;
        }, {
            description?: string | undefined;
        }>>;
        mutation: z.ZodLiteral<true>;
    }, "strip", z.ZodTypeAny, {
        inputs: unknown[];
        mutation: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    }, {
        inputs: unknown[];
        mutation: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    }>]>, z.ZodObject<{
        inputs: z.ZodArray<z.ZodUnknown, "many">;
        meta: z.ZodOptional<z.ZodObject<{
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            description?: string | undefined;
        }, {
            description?: string | undefined;
        }>>;
        subscription: z.ZodLiteral<true>;
    }, "strip", z.ZodTypeAny, {
        inputs: unknown[];
        subscription: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    }, {
        inputs: unknown[];
        subscription: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    }>]>;
}, "strip", z.ZodTypeAny, {
    _def: ({
        inputs: unknown[];
        query: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    } | {
        inputs: unknown[];
        mutation: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    } | {
        inputs: unknown[];
        subscription: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    }) & ({
        inputs: unknown[];
        query: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    } | {
        inputs: unknown[];
        mutation: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    } | {
        inputs: unknown[];
        subscription: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    } | undefined);
}, {
    _def: ({
        inputs: unknown[];
        query: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    } | {
        inputs: unknown[];
        mutation: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    } | {
        inputs: unknown[];
        subscription: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    }) & ({
        inputs: unknown[];
        query: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    } | {
        inputs: unknown[];
        mutation: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    } | {
        inputs: unknown[];
        subscription: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    } | undefined);
}>;
export type Procedure = z.infer<typeof ProcedureSchema>;
export declare function isProcedure(obj: unknown | Function): obj is Procedure;
declare const QuerySchema: z.ZodObject<{
    _def: z.ZodObject<{
        inputs: z.ZodArray<z.ZodUnknown, "many">;
        meta: z.ZodOptional<z.ZodObject<{
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            description?: string | undefined;
        }, {
            description?: string | undefined;
        }>>;
        query: z.ZodLiteral<true>;
    }, "strip", z.ZodTypeAny, {
        inputs: unknown[];
        query: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    }, {
        inputs: unknown[];
        query: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    _def: {
        inputs: unknown[];
        query: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    };
}, {
    _def: {
        inputs: unknown[];
        query: true;
        meta?: {
            description?: string | undefined;
        } | undefined;
    };
}>;
export type Query = z.infer<typeof QuerySchema>;
export type RouterOrProcedure = Router | Procedure;
export {};
