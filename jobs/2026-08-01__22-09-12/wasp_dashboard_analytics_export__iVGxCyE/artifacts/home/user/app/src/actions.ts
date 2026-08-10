import type { CreateTransaction } from "wasp/server/operations";

type CreateTransactionInput = {
  date: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
  category: string;
  description: string;
};

type Transaction = {
  id: number;
  date: Date;
  amount: number;
  type: string;
  category: string;
  description: string;
  userId: number;
};

export const createTransaction: CreateTransaction<CreateTransactionInput, Transaction> = async (
  input,
  context
) => {
  const userId = context.user?.id;
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const transaction = await context.entities.Transaction.create({
    data: {
      date: new Date(input.date),
      amount: input.amount,
      type: input.type,
      category: input.category,
      description: input.description,
      userId,
    },
  });

  return transaction;
};
