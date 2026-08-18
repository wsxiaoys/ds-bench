import { prisma } from 'wasp/server'

export const getAccounts = async (args: any, context: any) => {
  return prisma.account.findMany({
    orderBy: { name: 'asc' },
  })
}

export const getLedger = async (args: any, context: any) => {
  return prisma.ledgerEntry.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      fromAccount: true,
      toAccount: true,
    },
  })
}
