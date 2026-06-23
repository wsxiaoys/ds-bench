import { type as originalType, Type } from "arktype";
import { Product } from "./types";
import { DeclareContext, validateDeclared } from "arktype/internal/declare.js";

type CustomDeclarationParser<$> = <preinferred = any, ctx extends DeclareContext = {}>() => {
    <const def>(def: validateDeclared<preinferred, def, $, ctx>): Type<preinferred, $>;
    type: <const def>(def: validateDeclared<preinferred, def, $, ctx>) => Type<preinferred, $>;
};

const type = {
  ...originalType,
  declare: <preinferred = any, ctx extends DeclareContext = {}>() => {
    const d = originalType.declare<preinferred, ctx>();
    const fn = (def: any) => d.type(def);
    return Object.assign(fn, d);
  }
} as any as Omit<typeof originalType, "declare"> & { declare: CustomDeclarationParser<{}> };

const brokenSchema = type.declare<Product>()({
  id: "string",
  sku: "string",
  price: "number"
  // tags is intentionally omitted
});

export default brokenSchema;
