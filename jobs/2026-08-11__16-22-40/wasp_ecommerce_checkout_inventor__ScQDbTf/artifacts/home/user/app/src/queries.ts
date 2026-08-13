import { type GetProducts, type ValidateCoupon } from "wasp/server/operations"
import { type Product, type Coupon } from "wasp/entities"
import { HttpError } from "wasp/server"

export const getProducts: GetProducts<void, Product[]> = async (args, context) => {
  return context.entities.Product.findMany({
    orderBy: { id: "asc" }
  })
}

export const validateCoupon: ValidateCoupon<{ code: string }, Coupon> = async (args, context) => {
  const coupon = await context.entities.Coupon.findUnique({
    where: { code: args.code.toUpperCase() }
  })
  if (!coupon) {
    throw new HttpError(404, "Invalid coupon code")
  }
  return coupon
}
