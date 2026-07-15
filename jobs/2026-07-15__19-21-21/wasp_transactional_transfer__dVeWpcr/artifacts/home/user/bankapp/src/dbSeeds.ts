export const devSeed = async (prisma: any) => {
  await prisma.ledgerEntry.deleteMany({})
  const accounts: Array<[string, number]> = [
    ["Alice", 100],
    ["Bob", 50],
  ]
  for (const [name, balance] of accounts) {
    await prisma.account.upsert({
      where: { name },
      update: { balance },
      create: { name, balance },
    })
  }
}
