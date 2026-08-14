import type { CreateTransaction } from "wasp/server/operations";
import { HttpError } from "wasp/server";

type CreateTransactionArgs = {
  date: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
};

export const createTransaction: CreateTransaction<CreateTransactionArgs, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  return context.entities.Transaction.create({
    data: {
      date: new Date(args.date),
      amount: args.amount,
      type: args.type,
      category: args.category,
      description: args.description,
      userId: context.user.id,
    },
  });
};
