import { HttpError, prisma } from 'wasp/server'
import type { Account, LedgerEntry } from 'wasp/entities'

// The full Prisma client (imported from `wasp/server`) exposes `$transaction`,
// which lets us wrap several writes in a single atomic database transaction.
// The per-model delegates on `context.entities` cannot do this on their own.
//
// We use an *interactive* transaction so the debit, credit, and ledger insert
// either all commit together or all roll back together. We run it at the
// `Serializable` isolation level (the only level Prisma exposes for SQLite, and
// the strongest) so concurrent transfers cannot lost-update or partially apply.
// If two concurrent transactions conflict, SQLite/Prisma aborts one with a
// serialization error (Prisma code `P2034`); we detect that and retry the whole
// operation a few times before giving up.

const MAX_RETRIES = 5
const BASE_DELAY_MS = 50

type TransferInput = {
  from: string
  to: string
  amount: number
}

type TransferResult = {
  from: { name: string; balance: number }
  to: { name: string; balance: number }
  amount: number
  ledgerCount: number
}

function isSerializationError(error: unknown): boolean {
  if (error == null || typeof error !== 'object') return false
  // Prisma errors expose a `code` property. P2034 = transaction conflict /
  // serialization failure (write conflict or deadlock). This is the transient,
  // retryable case we want to handle gracefully.
  const code = (error as { code?: unknown }).code
  return code === 'P2034'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const transferFunds = async (
  args: TransferInput,
  context: {
    entities: { Account: typeof prisma.account; LedgerEntry: typeof prisma.ledgerEntry }
  },
): Promise<TransferResult> => {
  const { from: fromName, to: toName, amount } = args

  // Basic input validation.
  if (
    typeof fromName !== 'string' ||
    typeof toName !== 'string' ||
    typeof amount !== 'number' ||
    !Number.isInteger(amount) ||
    amount <= 0
  ) {
    throw new HttpError(400, 'Invalid arguments: { from: string, to: string, amount: positive integer } expected.')
  }

  if (fromName === toName) {
    throw new HttpError(400, 'Cannot transfer funds to the same account.')
  }

  // We reference context.entities so Wasp injects the entities (and so it knows
  // which caches to invalidate), but the actual writes are performed through the
  // transaction client `tx` returned by `prisma.$transaction`.
  void context.entities

  let lastError: unknown

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await prisma.$transaction(
        async (tx) => {
          // Lock / read both accounts inside the transaction. Because the
          // isolation level is Serializable, these reads (and the subsequent
          // writes) are protected from concurrent modification.
          const sender = await tx.account.findUnique({ where: { name: fromName } })
          const recipient = await tx.account.findUnique({ where: { name: toName } })

          if (!sender) {
            throw new HttpError(404, `Account "${fromName}" does not exist.`)
          }
          if (!recipient) {
            throw new HttpError(404, `Account "${toName}" does not exist.`)
          }

          if (sender.balance < amount) {
            // Throwing inside the interactive transaction causes the whole
            // transaction to roll back: no balance changes, no ledger record.
            throw new HttpError(
              400,
              `Insufficient funds: "${fromName}" has ${sender.balance} but ${amount} was requested.`,
              { from: fromName, balance: sender.balance, amount },
            )
          }

          const newSenderBalance = sender.balance - amount
          const newRecipientBalance = recipient.balance + amount

          // Debit the sender and credit the recipient.
          const [updatedSender, updatedRecipient] = await Promise.all([
            tx.account.update({
              where: { name: fromName },
              data: { balance: newSenderBalance },
            }),
            tx.account.update({
              where: { name: toName },
              data: { balance: newRecipientBalance },
            }),
          ])

          // Create the ledger record describing this transfer.
          await tx.ledgerEntry.create({
            data: {
              amount,
              fromAccountId: updatedSender.id,
              toAccountId: updatedRecipient.id,
            },
          })

          // Count the ledger records that exist after the transfer, still
          // within the transaction so the count reflects the just-inserted row.
          const ledgerCount = await tx.ledgerEntry.count()

          return {
            from: { name: updatedSender.name, balance: updatedSender.balance },
            to: { name: updatedRecipient.name, balance: updatedRecipient.balance },
            amount,
            ledgerCount,
          } satisfies TransferResult
        },
        {
          // Serializable is the strongest isolation level and the only one
          // Prisma exposes for SQLite. It prevents lost updates and partial
          // applies between concurrent transfers.
          isolationLevel: 'Serializable',
          maxWait: 10000,
          timeout: 10000,
        },
      )

      return result
    } catch (error) {
      // HttpError signals a genuine, non-transient failure (insufficient funds,
      // missing account, bad input). Propagate it as-is so the database is left
      // untouched and the client gets the correct status code.
      if (error instanceof HttpError) {
        throw error
      }

      if (isSerializationError(error)) {
        lastError = error
        // Back off a little before retrying to reduce the chance of colliding
        // again with the concurrent transaction that won the conflict.
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt))
        continue
      }

      // Any other unexpected error is rethrown.
      throw error
    }
  }

  // We exhausted our retries due to repeated serialization conflicts.
  throw new HttpError(
    503,
    'Transfer could not be completed due to concurrent transaction conflicts. Please try again.',
  )
}

// Keep these type imports "used" so the generated client types are referenced
// for downstream consumers, even though we operate via the dynamic prisma client.
export type { Account, LedgerEntry }