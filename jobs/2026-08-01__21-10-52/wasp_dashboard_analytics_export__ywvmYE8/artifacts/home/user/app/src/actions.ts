import { HttpError } from "wasp/server";

export const createTransaction = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User is not authenticated");
  }

  const { date, amount, type, category, description } = args;

  if (!date || amount === undefined || !type || !category || !description) {
    throw new HttpError(400, "Missing required fields");
  }

  if (type !== "INCOME" && type !== "EXPENSE") {
    throw new HttpError(400, "Invalid transaction type");
  }

  return context.entities.Transaction.create({
    data: {
      date: new Date(date),
      amount: Number(amount),
      type,
      category,
      description,
      userId: context.user.id,
    },
  });
};
