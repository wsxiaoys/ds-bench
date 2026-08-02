import { type GetProducts } from "wasp/server/operations";
import { type Product } from "wasp/entities";

export const getProducts: GetProducts<void, Product[]> = async (
  _args,
  context,
) => {
  return context.entities.Product.findMany({
    orderBy: { name: "asc" },
  });
};
