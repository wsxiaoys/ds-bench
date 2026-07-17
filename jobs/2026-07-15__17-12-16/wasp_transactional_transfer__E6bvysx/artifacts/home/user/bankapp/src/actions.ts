import { prisma } from 'wasp/server'
import { HttpError } from 'wasp/server'

interface TransferArgs {
  from: string
  to: string
  amount: number
}

interface TransferResult {
  from: { name: string; balance: number }
  to: { name: string; balance: number }
  amount: number
  ledgerCount: number
}

export const transferFunds = async (
  args: TransferArgs,
  context: any
): Promise<TransferResult> => {
  const { from, to, amount } = args

  // 1. Basic validation
  if (!from || typeof from !== 'string') {
    throw new HttpError(400, 'Sender account name must be a valid string')
  }
  if (!to || typeof to !== 'string') {
    throw new HttpError(400, 'Recipient account name must be a valid string')
  }
  if (from === to) {
    throw new HttpError(400, 'Sender and recipient accounts must be different')
  }
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw new HttpError(400, 'Amount must be a positive integer')
  }

  const maxRetries = 5
  let attempt = 0

  while (true) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Find sender account
          const fromAccount = await tx.account.findUnique({
            where: { name: from },
          })
          if (!fromAccount) {
            throw new HttpError(400, `Sender account '${from}' not found`)
          }

          // Find recipient account
          const toAccount = await tx.account.findUnique({
            where: { name: to },
          })
          if (!toAccount) {
            throw new HttpError(400, `Recipient account '${to}' not found`)
          }

          // Check if sender has enough balance
          if (fromAccount.balance < amount) {
            throw new HttpError(400, `Insufficient funds in sender account '${from}'`)
          }

          // Debit sender balance
          const updatedFrom = await tx.account.update({
            where: { id: fromAccount.id },
            data: { balance: { decrement: amount } },
          })

          // Credit recipient balance
          const updatedTo = await tx.account.update({
            where: { id: toAccount.id },
            data: { balance: { increment: amount } },
          })

          // Record transfer in ledger
          await tx.ledgerEntry.create({
            data: {
              amount,
              fromAccountId: fromAccount.id,
              toAccountId: toAccount.id,
            },
          })

          // Get total ledger record count
          const ledgerCount = await tx.ledgerEntry.count()

          return {
            from: { name: updatedFrom.name, balance: updatedFrom.balance },
            to: { name: updatedTo.name, balance: updatedTo.balance },
            amount,
            ledgerCount,
          }
        },
        {
          isolationLevel: 'Serializable',
        }
      )
    } catch (error: any) {
      // If it's our application HttpError (or behaves like one), throw it directly
      if (
        error instanceof HttpError ||
        (error && typeof error === 'object' && 'statusCode' in error)
      ) {
        throw error
      }

      // Check if it's a transient database error that should be retried.
      // SQLite/Prisma transient error codes:
      // P2034: Transaction failed due to a write conflict or a deadlock.
      const isTransient =
        error.code === 'P2034' ||
        (error.message &&
          (error.message.includes('write conflict') ||
            error.message.includes('deadlock') ||
            error.message.includes('busy') ||
            error.message.includes('lock')))

      if (isTransient && attempt < maxRetries) {
        attempt++
        // Exponential backoff with jitter
        const delay = Math.min(100, Math.pow(2, attempt) * 10) + Math.random() * 10
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }

      // For non-transient or exceeded retry errors, map to an HttpError
      throw new HttpError(500, error.message || 'Internal database error')
    }
  }
}
