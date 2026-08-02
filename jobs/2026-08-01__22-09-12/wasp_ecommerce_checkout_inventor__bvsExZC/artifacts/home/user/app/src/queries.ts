import { type GetProducts, type GetCart } from "wasp/server/operations";

type ProductResult = {
  id: number;
  name: string;
  price: number;
  inventory: number;
};

export const getProducts: GetProducts<void, ProductResult[]> = async (_args, context) => {
  const products = await context.entities.Product.findMany({
    select: {
      id: true,
      name: true,
      price: true,
      inventory: true,
    },
    orderBy: { id: "asc" },
  });
  return products;
};

type CartResult = {
  id: number;
  name: string;
  price: number;
  inventory: number;
}[];

export const getCart: GetCart<void, CartResult> = async (_args, context) => {
  const products = await context.entities.Product.findMany({
    select: {
      id: true,
      name: true,
      price: true,
      inventory: true,
    },
    orderBy: { id: "asc" },
  });
  return products;
};
