import { prisma, HttpError } from 'wasp/server'
import { Prisma } from '@prisma/client'

export const transferFunds = async (
  args: { from: string; to: string; amount: number },
  context: any
) => {
  const { from, to, amount } = args;

  if (typeof from !== 'string' || !from) {
    throw new HttpError(400, "Sender account name is required.");
  }
  if (typeof to !== 'string' || !to) {
    throw new HttpError(400, "Recipient account name is required.");
  }
  if (from === to) {
    throw new HttpError(400, "Sender and recipient accounts must be different.");
  }
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw new HttpError(400, "Amount must be a positive integer.");
  }

  const MAX_RETRIES = 5;
  let attempt = 0;

  while (true) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // 1. Fetch sender and recipient accounts
          const sender = await tx.account.findUnique({
            where: { name: from },
          });
          const recipient = await tx.account.findUnique({
            where: { name: to },
          });

          if (!sender) {
            throw new HttpError(400, `Sender account '${from}' not found.`);
          }
          if (!recipient) {
            throw new HttpError(400, `Recipient account '${to}' not found.`);
          }

          // 2. Check sender balance
          if (sender.balance < amount) {
            throw new HttpError(400, `Insufficient funds in sender's account.`);
          }

          // 3. Debit sender
          const updatedSender = await tx.account.update({
            where: { name: from },
            data: { balance: { decrement: amount } },
          });

          // 4. Credit recipient
          const updatedRecipient = await tx.account.update({
            where: { name: to },
            data: { balance: { increment: amount } },
          });

          // 5. Create ledger entry
          await tx.ledgerEntry.create({
            data: {
              amount,
              fromAccountId: sender.id,
              toAccountId: recipient.id,
            },
          });

          // 6. Get total ledger count
          const ledgerCount = await tx.ledgerEntry.count();

          return {
            from: {
              name: updatedSender.name,
              balance: updatedSender.balance,
            },
            to: {
              name: updatedRecipient.name,
              balance: updatedRecipient.balance,
            },
            amount,
            ledgerCount,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );
    } catch (error: any) {
      // If it's a known HttpError from our code, don't retry, just throw it directly
      if (error instanceof HttpError || error.statusCode === 400 || error.name === 'HttpError') {
        throw error;
      }

      attempt++;

      // Check if it's a transient serialization failure
      const isTransient =
        error.code === 'P2034' ||
        error.message?.includes('busy') ||
        error.message?.includes('locked') ||
        error.message?.includes('conflict') ||
        error.message?.includes('deadlock') ||
        error.message?.includes('serialize');

      if (isTransient && attempt < MAX_RETRIES) {
        const delay = Math.min(100 * Math.pow(2, attempt) + Math.random() * 50, 1000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // If we ran out of retries or it's not a transient error, throw it
      throw error;
    }
  }
};
