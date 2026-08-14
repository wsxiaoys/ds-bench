import { HttpError } from "wasp/server";
import type { CreateTransaction } from "wasp/server/operations";

export const createTransaction: CreateTransaction<{
  date: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
}, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const { date, amount, type, category, description } = args;

  return context.entities.Transaction.create({
    data: {
      date: new Date(date),
      amount,
      type,
      category,
      description,
      user: { connect: { id: context.user.id } },
    },
  });
};
