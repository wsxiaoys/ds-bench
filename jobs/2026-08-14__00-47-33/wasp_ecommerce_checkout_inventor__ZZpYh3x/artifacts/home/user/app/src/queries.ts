import { HttpError } from "wasp/server";

export const getProducts = async (args: any, context: any) => {
  return context.entities.Product.findMany({
    orderBy: { id: "asc" },
  });
};

export const getCoupon = async (args: { code: string }, context: any) => {
  if (!args.code) {
    throw new HttpError(400, "Coupon code is required");
  }
  const coupon = await context.entities.Coupon.findUnique({
    where: { code: args.code.toUpperCase() },
  });
  if (!coupon) {
    throw new HttpError(404, "Invalid coupon code");
  }
  return coupon;
};
