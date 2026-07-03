'use strict';

var fs = require('fs');
var node_url = require('node:url');
var node_path = require('node:path');
var zod = require('zod');
var zodToJsonSchema = require('zod-to-json-schema');

const TRPCPanelMetaSchema = zod.z.object({
    description: zod.z.string().optional(),
});

zod.z.object({});
const SharedProcedureDefPropertiesSchema = zod.z.object({
    inputs: zod.z.unknown().array(),
    meta: TRPCPanelMetaSchema.optional(),
});
const QueryDefSchema = SharedProcedureDefPropertiesSchema.merge(zod.z.object({
    query: zod.z.literal(true),
}));
function isQueryDef(obj) {
    return QueryDefSchema.safeParse(obj).success;
}
const MutationDefSchema = SharedProcedureDefPropertiesSchema.merge(zod.z.object({
    mutation: zod.z.literal(true),
}));
function isMutationDef(obj) {
    return MutationDefSchema.safeParse(obj).success;
}
const SubscriptionDefSchema = SharedProcedureDefPropertiesSchema.merge(zod.z.object({
    subscription: zod.z.literal(true),
}));
function isSubscriptionDef(obj) {
    return SubscriptionDefSchema.safeParse(obj).success;
}
const ProcedureDefSchema = QueryDefSchema.or(MutationDefSchema).or(SubscriptionDefSchema);
const RouterDefSchema = zod.z.object({
    router: zod.z.literal(true),
});
const RouterSchema = zod.z.object({
    _def: RouterDefSchema,
});
function isRouter(obj) {
    return RouterSchema.safeParse(obj).success;
}
zod.z.object({
    _def: ProcedureDefSchema,
});
function isProcedure(obj) {
    if (typeof obj !== "function" || !("_def" in obj))
        return false;
    return ProcedureDefSchema.safeParse(obj._def).success;
}
zod.z.object({
    _def: QueryDefSchema,
});

function logParseError(procedurePath, error) {
    console.warn(`trpc-panel: Failed to parse procedure ${procedurePath}, ${error}`);
}

function nodePropertiesFromRef(references) {
    return Object.assign({ path: references.path }, (references.optional && { optional: true }));
}

const parseZodStringDef = (def, refs) => {
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return Object.assign({ type: "string" }, nodePropertiesFromRef(refs));
};

const parseZodArrayDef = (def, refs) => {
    const { type } = def;
    const childType = zodSelectorFunction(type._def, Object.assign(Object.assign({}, refs), { path: [] }));
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return Object.assign({ type: "array", childType }, nodePropertiesFromRef(refs));
};

const parseZodBooleanFieldDef = (def, refs) => {
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return Object.assign({ type: "boolean" }, nodePropertiesFromRef(refs));
};

function isZodThreePointTwenty(def) {
    return "optionsMap" in def;
}
function makeDefConsistent(def) {
    const optionsMap = isZodThreePointTwenty(def) ? def.optionsMap : def.options;
    return {
        typeName: zod.ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
        discriminator: def.discriminator,
        options: optionsMap,
    };
}
const parseZodDiscriminatedUnionDef = (def, refs) => {
    const defConsistent = makeDefConsistent(def);
    const entries = Array.from(defConsistent.options.entries());
    const nodeEntries = entries.map(([discriminatorValue, zodObj]) => [
        discriminatorValue,
        zodSelectorFunction(zodObj._def, refs),
    ]);
    const nodesMap = Object.fromEntries(nodeEntries);
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return Object.assign({ type: "discriminated-union", discriminatedUnionValues: entries.map(([n]) => n), discriminatedUnionChildrenMap: nodesMap, discriminatorName: def.discriminator }, nodePropertiesFromRef(refs));
};

const parseZodEnumDef = (def, refs) => {
    const values = def.values;
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return Object.assign({ type: "enum", enumValues: values }, nodePropertiesFromRef(refs));
};

const parseZodLiteralDef = (def, refs) => {
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return Object.assign({ type: "literal", value: def.value }, nodePropertiesFromRef(refs));
};

const parseZodNumberDef = (def, refs) => {
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return Object.assign({ type: "number" }, nodePropertiesFromRef(refs));
};

const parseZodObjectDef = (def, refs) => {
    const shape = def.shape();
    const children = {};
    for (var propertyName of Object.keys(shape)) {
        const node = zodSelectorFunction(shape[propertyName]._def, Object.assign(Object.assign({}, refs), { path: refs.path.concat([propertyName]) }));
        children[propertyName] = node;
    }
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return Object.assign({ type: "object", children }, nodePropertiesFromRef(refs));
};

const parseZodOptionalDef = (def, refs) => {
    const parsedInner = zodSelectorFunction(def.innerType._def, refs);
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return Object.assign(Object.assign({}, parsedInner), { optional: true });
};

function parseZodNullableDef(def, refs) {
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return zodSelectorFunction(def.innerType._def, refs);
}

function parseZodBigIntDef(def, refs) {
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return Object.assign({ type: "number" }, nodePropertiesFromRef(refs));
}

function parseZodBrandedDef(def, refs) {
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return zodSelectorFunction(def.type._def, refs);
}

function parseZodDefaultDef(def, refs) {
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return zodSelectorFunction(def.innerType._def, refs);
}

function parseZodEffectsDef(def, refs) {
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return zodSelectorFunction(def.schema._def, refs);
}

function parseZodNullDef(def, refs) {
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return Object.assign({ type: "literal", value: null }, nodePropertiesFromRef(refs));
}

function parseZodPromiseDef(def, refs) {
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return zodSelectorFunction(def.type._def, refs);
}

function parseZodUndefinedDef(def, refs) {
    refs.addDataFunctions.addDescriptionIfExists(def, refs);
    return Object.assign({ type: "literal", value: undefined }, nodePropertiesFromRef(refs));
}

function parseZodVoidDef(_, refs) {
    return {
        type: "literal",
        value: undefined,
        path: refs.path,
    };
}

const zodSelectorFunction = (def, references) => {
    switch (def.typeName) {
        case zod.ZodFirstPartyTypeKind.ZodArray:
            return parseZodArrayDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodBoolean:
            return parseZodBooleanFieldDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodDiscriminatedUnion:
            return parseZodDiscriminatedUnionDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodEnum:
            return parseZodEnumDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodLiteral:
            return parseZodLiteralDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodNumber:
            return parseZodNumberDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodObject:
            return parseZodObjectDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodOptional:
            return parseZodOptionalDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodString:
            return parseZodStringDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodNullable:
            return parseZodNullableDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodBigInt:
            return parseZodBigIntDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodBranded:
            return parseZodBrandedDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodDefault:
            return parseZodDefaultDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodEffects:
            return parseZodEffectsDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodNull:
            return parseZodNullDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodPromise:
            return parseZodPromiseDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodUndefined:
            return parseZodUndefinedDef(def, references);
        case zod.ZodFirstPartyTypeKind.ZodVoid:
            return parseZodVoidDef(def, references);
    }
    return { type: "unsupported", path: references.path };
};

const inputParserMap = {
    zod: (zodObject, refs) => {
        return zodSelectorFunction(zodObject._def, refs);
    },
};
const emptyZodObject = zod.z.object({});
function nodeAndInputSchemaFromInputs(inputs, _routerPath, options, addDataFunctions) {
    if (!inputs.length) {
        return {
            parseInputResult: "success",
            schema: zodToJsonSchema.zodToJsonSchema(emptyZodObject, {
                errorMessages: true,
                $refStrategy: "none",
            }),
            node: inputParserMap["zod"](emptyZodObject, {
                path: [],
                options,
                addDataFunctions,
            }),
        };
    }
    if (inputs.length !== 1) {
        return { parseInputResult: "failure" };
    }
    const input = inputs[0];
    return {
        parseInputResult: "success",
        schema: zodToJsonSchema.zodToJsonSchema(input, {
            errorMessages: true,
            $refStrategy: "none",
        }),
        node: zodSelectorFunction(input._def, {
            path: [],
            options,
            addDataFunctions,
        }),
    };
}
function parseProcedure(procedure, path, options) {
    var _a;
    const { _def } = procedure;
    const { inputs } = _def;
    const parseExtraData = {
        parameterDescriptions: {},
    };
    const nodeAndInput = nodeAndInputSchemaFromInputs(inputs, path, options, {
        addDescriptionIfExists: (def, refs) => {
            if (def.description) {
                parseExtraData.parameterDescriptions[refs.path.join(".")] =
                    def.description;
            }
        },
    });
    if (nodeAndInput.parseInputResult === "failure") {
        return null;
    }
    const t = (() => {
        if (isQueryDef(_def))
            return "query";
        if (isMutationDef(_def))
            return "mutation";
        if (isSubscriptionDef(_def))
            return "subscription";
        return null;
    })();
    if (!t) {
        return null;
    }
    return {
        inputSchema: nodeAndInput.schema,
        node: nodeAndInput.node,
        nodeType: "procedure",
        procedureType: t,
        pathFromRootRouter: path,
        extraData: Object.assign(Object.assign({}, parseExtraData), (((_a = procedure._def.meta) === null || _a === void 0 ? void 0 : _a.description) && {
            description: procedure._def.meta.description,
        })),
    };
}

const skipSet = new Set(["createCaller", "_def", "getErrorShape"]);
function parseRouter(router, routerPath, options) {
    const children = {};
    var hasChild = false;
    for (var [procedureOrRouterPath, child] of Object.entries(router)) {
        if (skipSet.has(procedureOrRouterPath))
            continue;
        const newPath = routerPath.concat([procedureOrRouterPath]);
        const parsedNode = (() => {
            if (isRouter(child)) {
                return parseRouter(child, newPath, options);
            }
            if (isProcedure(child)) {
                return parseProcedure(child, newPath, options);
            }
            return null;
        })();
        if (!parsedNode) {
            logParseError(newPath.join("."), "Couldn't parse node.");
            continue;
        }
        hasChild = true;
        children[procedureOrRouterPath] = parsedNode;
    }
    if (!hasChild)
        logParseError(routerPath.join("."), `Router doesn't have any successfully parsed children.`);
    return { children, nodeType: "router", path: routerPath };
}
function parseRouterWithOptions(router, parseRouterOptions) {
    if (!isRouter(router)) {
        throw new Error("Non trpc router passed to trpc panel.");
    }
    return parseRouter(router, [], parseRouterOptions);
}

const defaultParseRouterOptions = {
    logFailedProcedureParse: true,
    transformer: "superjson",
};
const __dirname$1 = node_path.dirname(node_url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (document.currentScript && document.currentScript.src || new URL('index.js', document.baseURI).href))));
const javascriptReplaceSymbol = "{{js}}";
const cssReplaceSymbol = "{{css}}";
const routerReplaceSymbol = '"{{parsed_router}}"';
const optionsReplaceSymbol = '"{{options}}"';
const bundlePath = __dirname$1 + "/react-app/bundle.js";
const indexPath = __dirname$1 + "/react-app/index.html";
const cssPath = __dirname$1 + "/react-app/index.css";
const bundleJs = fs.readFileSync(bundlePath).toString();
const indexHtml = fs.readFileSync(indexPath).toString();
const indexCss = fs.readFileSync(cssPath).toString();
function injectParams(string, injectionParams) {
    var r = string;
    for (var param of injectionParams) {
        r = injectInString(param.searchFor, r, param.injectString);
    }
    return r;
}
function injectInString(searchFor, string, injectString) {
    const startIndex = string.indexOf(searchFor);
    return (string.slice(0, startIndex) +
        injectString +
        string.slice(startIndex + searchFor.length));
}
let cache = {
    val: null,
};
function renderTrpcPanel(router, options) {
    if (options.cache === true && cache.val)
        return cache.val;
    const bundleInjectionParams = [
        {
            searchFor: routerReplaceSymbol,
            injectString: JSON.stringify(parseRouterWithOptions(router, Object.assign(Object.assign({}, defaultParseRouterOptions), options))),
        },
        {
            searchFor: optionsReplaceSymbol,
            injectString: JSON.stringify(options),
        },
    ];
    const bundleInjected = injectParams(bundleJs, bundleInjectionParams);
    const script = `<script>${bundleInjected}</script>`;
    const css = `<style>${indexCss}</style>`;
    const htmlReplaceParams = [
        {
            searchFor: javascriptReplaceSymbol,
            injectString: script,
        },
        {
            searchFor: cssReplaceSymbol,
            injectString: css,
        },
    ];
    cache.val = injectParams(indexHtml, htmlReplaceParams);
    return cache.val;
}

exports.parseRouterWithOptions = parseRouterWithOptions;
exports.renderTrpcPanel = renderTrpcPanel;
