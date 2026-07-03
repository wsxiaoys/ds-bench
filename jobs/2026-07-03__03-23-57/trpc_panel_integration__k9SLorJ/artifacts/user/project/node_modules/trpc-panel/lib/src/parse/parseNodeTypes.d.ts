import { ZodTypeDef } from "zod";
import { ZodDiscriminatedUnionDefUnversioned } from "./input-mappers/zod/parsers/parseZodDiscriminatedUnionDef";
import { TrpcPanelExtraOptions } from "./parseRouter";
export type SharedInputNodeProperties = {
    path: (string | number)[];
    optional?: true;
};
type InputNodeTypes = ZodTypeDef | ZodDiscriminatedUnionDefUnversioned;
export type ArrayNode = {
    type: "array";
    childType: ParsedInputNode;
} & SharedInputNodeProperties;
export type ObjectNode = {
    type: "object";
    children: {
        [name: string]: ParsedInputNode;
    };
} & SharedInputNodeProperties;
export type EnumNode = {
    type: "enum";
    enumValues: string[];
} & SharedInputNodeProperties;
export type DiscriminatedUnionNode = {
    type: "discriminated-union";
    discriminatedUnionValues: string[];
    discriminatedUnionChildrenMap: {
        [value: string]: ObjectNode;
    };
    discriminatorName: string;
} & SharedInputNodeProperties;
export type LiteralNode = {
    type: "literal";
    value: string | boolean | number | bigint | null | undefined;
} & SharedInputNodeProperties;
export type StringNode = {
    type: "string";
} & SharedInputNodeProperties;
export type NumberNode = {
    type: "number";
} & SharedInputNodeProperties;
export type BooleanNode = {
    type: "boolean";
} & SharedInputNodeProperties;
export type UnsupportedNode = {
    type: "unsupported";
} & SharedInputNodeProperties;
export type ParsedInputNode = ArrayNode | ObjectNode | EnumNode | DiscriminatedUnionNode | LiteralNode | StringNode | NumberNode | BooleanNode | UnsupportedNode;
export type AddDataFunctions = {
    addDescriptionIfExists: (def: {
        description?: string;
    }, refs: ParseReferences) => void;
};
export type ParseReferences = {
    path: string[];
    optional?: true;
    options: TrpcPanelExtraOptions;
    addDataFunctions: AddDataFunctions;
};
export type ParseFunction<InputNodeType extends InputNodeTypes, ParsedNodeType extends ParsedInputNode> = (def: InputNodeType, references: ParseReferences) => ParsedNodeType;
export type ParserSelectorFunction<InputNodeType extends InputNodeTypes> = (inputNode: InputNodeType, references: ParseReferences) => ParsedInputNode;
export {};
