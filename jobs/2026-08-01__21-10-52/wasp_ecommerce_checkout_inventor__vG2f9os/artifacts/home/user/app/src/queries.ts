export const getProducts = async (args: any, context: any) => {
  return context.entities.Product.findMany({
    orderBy: { id: "asc" },
  });
};

export const validateCoupon = async (args: { code: string }, context: any) => {
  const { code } = args;
  if (!code) {
    throw new Error("Coupon code is required");
  }
  const coupon = await context.entities.Coupon.findUnique({
    where: { code: code.toUpperCase() },
  });
  if (!coupon) {
    throw new Error("Invalid coupon code");
  }
  return coupon;
};
