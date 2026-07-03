import { Procedure } from "./routerType";
import { JSON7SchemaType, ProcedureType, TrpcPanelExtraOptions } from "./parseRouter";
import { ParsedInputNode } from "@src/parse/parseNodeTypes";
export type ProcedureExtraData = {
    parameterDescriptions: {
        [path: string]: string;
    };
    description?: string;
};
export type ParsedProcedure = {
    inputSchema: JSON7SchemaType;
    node: ParsedInputNode;
    nodeType: "procedure";
    procedureType: ProcedureType;
    pathFromRootRouter: string[];
    extraData: ProcedureExtraData;
};
export declare function parseProcedure(procedure: Procedure, path: string[], options: TrpcPanelExtraOptions): ParsedProcedure | null;
