import { HttpError, prisma } from 'wasp/server'
import { Prisma } from '@prisma/client'

// Number of times to retry on a transient serialization failure (Prisma error
// code `P2034` - transaction failed due to a write conflict / serialization
// failure). SQLite only supports Serializable isolation, so under contention
// Prisma may surface a conflict that the next attempt can typically resolve.
const MAX_TX_RETRIES = 5

// We type the second argument as the Wasp-shaped context, but we only ever
// use the global `prisma` client (imported above) so we can run an
// interactive transaction that wraps all three writes atomically. The
// per-model delegates exposed via `context.entities` cannot, on their own,
// span multiple writes in a single transaction, which is why we deliberately
// reach for the full client here.
type TransferArgs = {
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

const isRetryableTransactionError = (err: unknown): boolean => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2034: "Transaction failed due to a write conflict or a deadlock.
    // Please retry your transaction." - this is the exact code Prisma uses
    // for transient serialization failures we want to retry.
    if (err.code === 'P2034') return true
  }
  // Prisma also occasionally wraps transient SQLITE_BUSY / SQLITE_LOCKED
  // errors in a generic PrismaClientUnknownRequestError; treat those the
  // same way so concurrent transfers stay safe even under heavy load.
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    const message = err.message ?? ''
    if (
      message.includes('SQLITE_BUSY') ||
      message.includes('database is locked') ||
      message.includes('write conflict') ||
      message.includes('serialization')
    ) {
      return true
    }
  }
  return false
}

export const transferFunds = async (
  args: TransferArgs,
  _context: { entities: { Account: typeof prisma.account; LedgerEntry: typeof prisma.ledgerEntry } }
): Promise<TransferResult> => {
  const fromName = args?.from
  const toName = args?.to
  const amount = args?.amount

  if (typeof fromName !== 'string' || typeof toName !== 'string') {
    throw new HttpError(400, '`from` and `to` must be account name strings.')
  }
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    throw new HttpError(400, '`amount` must be a positive integer.')
  }

  // Retry loop for transient serialization failures. Any HttpError thrown
  // inside the transaction callback propagates straight through without
  // being retried, so the database stays in a clean state and the client
  // receives the intended 400 response.
  let lastError: unknown = undefined
  for (let attempt = 0; attempt < MAX_TX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Look up the sender and recipient by their unique name inside
          // the same transaction so the rows we read are consistent with
          // the rows we update.
          const sender = await tx.account.findUnique({
            where: { name: fromName },
          })
          const recipient = await tx.account.findUnique({
            where: { name: toName },
          })

          if (!sender) {
            throw new HttpError(400, `Sender account "${fromName}" does not exist.`)
          }
          if (!recipient) {
            throw new HttpError(400, `Recipient account "${toName}" does not exist.`)
          }

          // Insufficient funds: throwing here aborts the interactive
          // transaction, so neither balance changes nor the ledger entry
          // is ever persisted.
          if (sender.balance < amount) {
            throw new HttpError(400, 'Insufficient funds.')
          }

          // Debit the sender.
          const updatedSender = await tx.account.update({
            where: { id: sender.id },
            data: { balance: { decrement: amount } },
          })

          // Credit the recipient.
          const updatedRecipient = await tx.account.update({
            where: { id: recipient.id },
            data: { balance: { increment: amount } },
          })

          // Record the transfer in the ledger. If either of the two updates
          // above throws, this `create` is never reached and Prisma rolls
          // back the entire transaction.
          await tx.ledgerEntry.create({
            data: {
              amount,
              fromAccountId: sender.id,
              toAccountId: recipient.id,
            },
          })

          // Count after the insert so the returned ledgerCount reflects the
          // just-created record. Counting is done inside the transaction so
          // we observe a consistent snapshot.
          const ledgerCount = await tx.ledgerEntry.count()

          return {
            from: { name: updatedSender.name, balance: updatedSender.balance },
            to: { name: updatedRecipient.name, balance: updatedRecipient.balance },
            amount,
            ledgerCount,
          }
        },
        {
          // `Serializable` is the strongest isolation level. Under SQLite
          // this is the only supported level and is the default, but we
          // request it explicitly so the code documents intent and is
          // portable to a Postgres backend if the project ever switches.
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      )
    } catch (err) {
      // HttpError must propagate untouched so the client sees the 400 and
      // the database is guaranteed untouched (the transaction callback
      // threw, so Prisma rolled back automatically).
      if (err instanceof HttpError) {
        throw err
      }

      if (isRetryableTransactionError(err) && attempt < MAX_TX_RETRIES - 1) {
        // Small, bounded backoff to give the contending transaction time to
        // finish before we retry.
        lastError = err
        await new Promise((resolve) =>
          setTimeout(resolve, 10 * (attempt + 1))
        )
        continue
      }

      // Anything else (unexpected DB error, etc.) bubbles up so the caller
      // gets a 500 response.
      throw err
    }
  }

  // We only land here if every retry was hit by a transient error. Surface
  // it as a 500 rather than silently dropping the request.
  throw new HttpError(
    500,
    'Transfer failed after multiple retries due to database contention.',
    lastError instanceof Error ? { message: lastError.message } : undefined
  )
}
