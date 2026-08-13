import type { Product, Coupon } from "wasp/entities";
import type { GetProducts, GetCoupon } from "wasp/server/operations";
import { HttpError } from "wasp/server";

export const getProducts: GetProducts<void, Product[]> = async (args, context) => {
  return context.entities.Product.findMany({
    orderBy: { name: "asc" },
  });
};

export const getCoupon: GetCoupon<{ code: string }, Coupon | null> = async (args, context) => {
  if (!args.code) {
    throw new HttpError(400, "Coupon code is required");
  }
  return context.entities.Coupon.findUnique({
    where: { code: args.code.toUpperCase() },
  });
};
