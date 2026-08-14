import { HttpError } from "wasp/server";
import type { CreateTransaction } from "wasp/server/operations";

export const createTransaction: CreateTransaction<
  {
    date: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    category: string;
    description: string;
  },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;
  const { date, amount, type, category, description } = args;

  if (type !== "INCOME" && type !== "EXPENSE") {
    throw new HttpError(400, "Type must be INCOME or EXPENSE");
  }

  const transaction = await context.entities.Transaction.create({
    data: {
      date: new Date(date + "T00:00:00Z"),
      amount,
      type,
      category,
      description,
      userId,
    },
  });

  return transaction;
};
