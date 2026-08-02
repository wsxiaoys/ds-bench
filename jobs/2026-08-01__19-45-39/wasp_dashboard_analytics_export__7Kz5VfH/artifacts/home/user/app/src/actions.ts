import { HttpError } from "wasp/server";
import type { CreateTransaction } from "wasp/server/operations";
import type { Transaction } from "wasp/entities";

type CreateTransactionInput = {
  date: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
};

export const createTransaction: CreateTransaction<
  CreateTransactionInput,
  Transaction
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401);
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
