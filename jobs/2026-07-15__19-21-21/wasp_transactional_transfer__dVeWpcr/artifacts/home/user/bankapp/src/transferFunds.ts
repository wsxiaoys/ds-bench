import { HttpError } from "wasp/server"
import { prisma } from "wasp/server"
import type { TransferFunds } from "wasp/server/operations"

type TransferFundsInput = {
  from: string
  to: string
  amount: number
}

type AccountSummary = {
  name: string
  balance: number
}

type TransferFundsOutput = {
  from: AccountSummary
  to: AccountSummary
  amount: number
  ledgerCount: number
}

const MAX_ATTEMPTS = 5
const RETRYABLE_PRISMA_ERROR_CODES = new Set([
  // Transaction failed due to a write conflict or a deadlock. Retriable.
  "P2034",
])

function isRetryableTransactionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    RETRYABLE_PRISMA_ERROR_CODES.has((error as { code: unknown }).code as string)
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Transfers `amount` whole currency units from the account named `from` to
// the account named `to`. Debiting the sender, crediting the recipient, and
// recording the ledger entry all happen inside a single, serializable Prisma
// interactive transaction so the operation is atomic: either everything
// commits, or nothing does.
export const transferFunds: TransferFunds<
  TransferFundsInput,
  TransferFundsOutput
> = async (args) => {
  const { from, to, amount } = args ?? ({} as TransferFundsInput)

  if (typeof from !== "string" || from.length === 0) {
    throw new HttpError(400, 'Field "from" must be a non-empty account name.')
  }
  if (typeof to !== "string" || to.length === 0) {
    throw new HttpError(400, 'Field "to" must be a non-empty account name.')
  }
  if (from === to) {
    throw new HttpError(400, "Cannot transfer funds to the same account.")
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new HttpError(400, "Amount must be a positive integer.")
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const sender = await tx.account.findUnique({ where: { name: from } })
          if (!sender) {
            throw new HttpError(400, `Account "${from}" does not exist.`)
          }

          const recipient = await tx.account.findUnique({ where: { name: to } })
          if (!recipient) {
            throw new HttpError(400, `Account "${to}" does not exist.`)
          }

          if (sender.balance < amount) {
            throw new HttpError(
              400,
              `Account "${from}" has insufficient funds for this transfer.`
            )
          }

          const updatedSender = await tx.account.update({
            where: { name: from },
            data: { balance: { decrement: amount } },
          })
          const updatedRecipient = await tx.account.update({
            where: { name: to },
            data: { balance: { increment: amount } },
          })

          await tx.ledgerEntry.create({
            data: {
              amount,
              fromAccountId: sender.id,
              toAccountId: recipient.id,
            },
          })

          const ledgerCount = await tx.ledgerEntry.count()

          return {
            from: { name: updatedSender.name, balance: updatedSender.balance },
            to: { name: updatedRecipient.name, balance: updatedRecipient.balance },
            amount,
            ledgerCount,
          }
        },
        { isolationLevel: "Serializable" }
      )
    } catch (error) {
      // Insufficient funds / missing accounts are permanent failures: fail fast.
      if (error instanceof HttpError) {
        throw error
      }

      // Concurrent transfers can cause transient serialization failures.
      // Retry a few times with a small backoff before giving up.
      const isLastAttempt = attempt === MAX_ATTEMPTS
      if (!isRetryableTransactionError(error) || isLastAttempt) {
        throw error
      }
      await sleep(20 * attempt)
    }
  }

  // Unreachable: the loop above always returns or throws.
  throw new HttpError(500, "Failed to transfer funds after multiple attempts.")
}
