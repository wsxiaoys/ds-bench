import { ObjectNode } from "@src/parse/parseNodeTypes";
import { z } from "zod";
import { ParsedProcedure } from "@src/parse/parseProcedure";
export declare const testTrpcInstance: {
    _config: import("@trpc/server").RootConfig<{
        ctx: {};
        meta: {
            description?: string | undefined;
        };
        errorShape: import("@trpc/server").DefaultErrorShape;
        transformer: import("@trpc/server").DefaultDataTransformer;
    }>;
    procedure: import("@trpc/server").ProcedureBuilder<{
        _config: import("@trpc/server").RootConfig<{
            ctx: {};
            meta: {
                description?: string | undefined;
            };
            errorShape: import("@trpc/server").DefaultErrorShape;
            transformer: import("@trpc/server").DefaultDataTransformer;
        }>;
        _ctx_out: {};
        _input_in: typeof import("@trpc/server").unsetMarker;
        _input_out: typeof import("@trpc/server").unsetMarker;
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
        _meta: {
            description?: string | undefined;
        };
    }>;
    middleware: <TNewParams extends import("@trpc/server").ProcedureParams<import("@trpc/server").AnyRootConfig, unknown, unknown, unknown, unknown, unknown, unknown>>(fn: import("@trpc/server").MiddlewareFunction<{
        _config: import("@trpc/server").RootConfig<{
            ctx: {};
            meta: {
                description?: string | undefined;
            };
            errorShape: import("@trpc/server").DefaultErrorShape;
            transformer: import("@trpc/server").DefaultDataTransformer;
        }>;
        _ctx_out: {};
        _input_out: unknown;
        _input_in: unknown;
        _output_in: unknown;
        _output_out: unknown;
        _meta: {
            description?: string | undefined;
        };
    }, TNewParams>) => import("@trpc/server").MiddlewareFunction<{
        _config: import("@trpc/server").RootConfig<{
            ctx: {};
            meta: {
                description?: string | undefined;
            };
            errorShape: import("@trpc/server").DefaultErrorShape;
            transformer: import("@trpc/server").DefaultDataTransformer;
        }>;
        _ctx_out: {};
        _input_out: unknown;
        _input_in: unknown;
        _output_in: unknown;
        _output_out: unknown;
        _meta: {
            description?: string | undefined;
        };
    }, TNewParams>;
    router: <TProcRouterRecord extends import("@trpc/server").ProcedureRouterRecord>(procedures: TProcRouterRecord) => import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
        ctx: {};
        meta: {
            description?: string | undefined;
        };
        errorShape: import("@trpc/server").DefaultErrorShape;
        transformer: import("@trpc/server").DefaultDataTransformer;
    }>, TProcRouterRecord>;
    mergeRouters: typeof import("@trpc/server").mergeRoutersGeneric;
};
export declare const parseTestRouterInputSchema: z.ZodObject<{
    id: z.ZodString;
    age: z.ZodNumber;
    expectedAgeOfDeath: z.ZodOptional<z.ZodNumber>;
    object: z.ZodObject<{
        nestedId: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        nestedId: string;
    }, {
        nestedId: string;
    }>;
    du: z.ZodDiscriminatedUnion<"d", [z.ZodObject<{
        d: z.ZodLiteral<"one">;
        oneProps: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        d: "one";
        oneProps: string;
    }, {
        d: "one";
        oneProps: string;
    }>, z.ZodObject<{
        d: z.ZodLiteral<"two">;
    }, "strip", z.ZodTypeAny, {
        d: "two";
    }, {
        d: "two";
    }>]>;
}, "strip", z.ZodTypeAny, {
    object: {
        nestedId: string;
    };
    id: string;
    age: number;
    du: {
        d: "one";
        oneProps: string;
    } | {
        d: "two";
    };
    expectedAgeOfDeath?: number | undefined;
}, {
    object: {
        nestedId: string;
    };
    id: string;
    age: number;
    du: {
        d: "one";
        oneProps: string;
    } | {
        d: "two";
    };
    expectedAgeOfDeath?: number | undefined;
}>;
export declare const expectedTestRouterInputParsedNode: ObjectNode;
export declare const testQueryExpectedParseResult: ParsedProcedure;
export declare const testMutationExpectedParseResult: ParsedProcedure;
export declare const testQuery: import("@trpc/server").BuildProcedure<"query", {
    _config: import("@trpc/server").RootConfig<{
        ctx: {};
        meta: {
            description?: string | undefined;
        };
        errorShape: import("@trpc/server").DefaultErrorShape;
        transformer: import("@trpc/server").DefaultDataTransformer;
    }>;
    _meta: {
        description?: string | undefined;
    };
    _ctx_out: {};
    _input_in: {
        object: {
            nestedId: string;
        };
        id: string;
        age: number;
        du: {
            d: "one";
            oneProps: string;
        } | {
            d: "two";
        };
        expectedAgeOfDeath?: number | undefined;
    };
    _input_out: {
        object: {
            nestedId: string;
        };
        id: string;
        age: number;
        du: {
            d: "one";
            oneProps: string;
        } | {
            d: "two";
        };
        expectedAgeOfDeath?: number | undefined;
    };
    _output_in: typeof import("@trpc/server").unsetMarker;
    _output_out: typeof import("@trpc/server").unsetMarker;
}, string>;
export declare const testMutation: import("@trpc/server").BuildProcedure<"mutation", {
    _config: import("@trpc/server").RootConfig<{
        ctx: {};
        meta: {
            description?: string | undefined;
        };
        errorShape: import("@trpc/server").DefaultErrorShape;
        transformer: import("@trpc/server").DefaultDataTransformer;
    }>;
    _meta: {
        description?: string | undefined;
    };
    _ctx_out: {};
    _input_in: {
        object: {
            nestedId: string;
        };
        id: string;
        age: number;
        du: {
            d: "one";
            oneProps: string;
        } | {
            d: "two";
        };
        expectedAgeOfDeath?: number | undefined;
    };
    _input_out: {
        object: {
            nestedId: string;
        };
        id: string;
        age: number;
        du: {
            d: "one";
            oneProps: string;
        } | {
            d: "two";
        };
        expectedAgeOfDeath?: number | undefined;
    };
    _output_in: typeof import("@trpc/server").unsetMarker;
    _output_out: typeof import("@trpc/server").unsetMarker;
}, string>;
export declare const parseTestRouter: import("@trpc/server").CreateRouterInner<import("@trpc/server").RootConfig<{
    ctx: {};
    meta: {
        description?: string | undefined;
    };
    errorShape: import("@trpc/server").DefaultErrorShape;
    transformer: import("@trpc/server").DefaultDataTransformer;
}>, {
    testQuery: import("@trpc/server").BuildProcedure<"query", {
        _config: import("@trpc/server").RootConfig<{
            ctx: {};
            meta: {
                description?: string | undefined;
            };
            errorShape: import("@trpc/server").DefaultErrorShape;
            transformer: import("@trpc/server").DefaultDataTransformer;
        }>;
        _meta: {
            description?: string | undefined;
        };
        _ctx_out: {};
        _input_in: {
            object: {
                nestedId: string;
            };
            id: string;
            age: number;
            du: {
                d: "one";
                oneProps: string;
            } | {
                d: "two";
            };
            expectedAgeOfDeath?: number | undefined;
        };
        _input_out: {
            object: {
                nestedId: string;
            };
            id: string;
            age: number;
            du: {
                d: "one";
                oneProps: string;
            } | {
                d: "two";
            };
            expectedAgeOfDeath?: number | undefined;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, string>;
    testMutation: import("@trpc/server").BuildProcedure<"mutation", {
        _config: import("@trpc/server").RootConfig<{
            ctx: {};
            meta: {
                description?: string | undefined;
            };
            errorShape: import("@trpc/server").DefaultErrorShape;
            transformer: import("@trpc/server").DefaultDataTransformer;
        }>;
        _meta: {
            description?: string | undefined;
        };
        _ctx_out: {};
        _input_in: {
            object: {
                nestedId: string;
            };
            id: string;
            age: number;
            du: {
                d: "one";
                oneProps: string;
            } | {
                d: "two";
            };
            expectedAgeOfDeath?: number | undefined;
        };
        _input_out: {
            object: {
                nestedId: string;
            };
            id: string;
            age: number;
            du: {
                d: "one";
                oneProps: string;
            } | {
                d: "two";
            };
            expectedAgeOfDeath?: number | undefined;
        };
        _output_in: typeof import("@trpc/server").unsetMarker;
        _output_out: typeof import("@trpc/server").unsetMarker;
    }, string>;
}>;
