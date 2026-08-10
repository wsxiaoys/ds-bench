export const getProducts = async (args: any, context: any) => {
  if (!context.user) {
    throw new Error("Unauthorized");
  }
  return context.entities.Product.findMany({
    include: {
      supplier: true,
    },
  });
};
