import { AnyZodObject } from "zod";
import { DiscriminatedUnionNode, ParseFunction } from "../../../parseNodeTypes";
type OptionsMap = Map<string, AnyZodObject>;
type ZodDiscriminatedUnionThreePointTwenty = {
    optionsMap: OptionsMap;
    discriminator: string;
    description?: string;
};
type ZodDiscriminatedUnionPreThreePointTwenty = {
    options: OptionsMap;
    discriminator: string;
    description?: string;
};
export type ZodDiscriminatedUnionDefUnversioned = ZodDiscriminatedUnionPreThreePointTwenty | ZodDiscriminatedUnionThreePointTwenty;
export declare const parseZodDiscriminatedUnionDef: ParseFunction<ZodDiscriminatedUnionDefUnversioned, DiscriminatedUnionNode>;
export {};
