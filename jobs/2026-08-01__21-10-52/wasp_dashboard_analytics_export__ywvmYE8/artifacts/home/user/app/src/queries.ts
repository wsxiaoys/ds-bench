import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";

export const getAnalytics = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User is not authenticated");
  }

  const { startDate, endDate, resolution } = args;

  if (!startDate || !endDate || !resolution) {
    throw new HttpError(400, "Missing required parameters: startDate, endDate, resolution");
  }

  const userId = context.user.id;
  const startMs = new Date(startDate + "T00:00:00.000Z").getTime();
  const endMs = new Date(endDate + "T23:59:59.999Z").getTime();

  let dateFormat = '%Y-%m-%d';
  if (resolution === 'month') {
    dateFormat = '%Y-%m';
  } else if (resolution === 'week') {
    dateFormat = '%Y-W%W';
  }

  // Time-series aggregation raw query using the global prisma instance
  const timeSeriesRaw: any = await prisma.$queryRawUnsafe(`
    SELECT 
      strftime('${dateFormat}', date / 1000, 'unixepoch') AS date,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) AS income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS expense,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END) AS net
    FROM "Transaction"
    WHERE "userId" = ? AND "date" >= ? AND "date" <= ?
    GROUP BY date
    ORDER BY date ASC
  `, userId, startMs, endMs);

  const timeSeries = timeSeriesRaw.map((row: any) => ({
    date: row.date,
    income: Number(row.income || 0),
    expense: Number(row.expense || 0),
    net: Number(row.net || 0),
  }));

  // Category breakdown raw query
  const categoryBreakdownRaw: any = await prisma.$queryRawUnsafe(`
    SELECT 
      category,
      type,
      SUM(amount) AS amount
    FROM "Transaction"
    WHERE "userId" = ? AND "date" >= ? AND "date" <= ?
    GROUP BY category, type
    ORDER BY amount DESC
  `, userId, startMs, endMs);

  const categoryBreakdown = categoryBreakdownRaw.map((row: any) => ({
    category: row.category,
    amount: Number(row.amount || 0),
    type: row.type as "INCOME" | "EXPENSE",
  }));

  // Summary calculation from the filtered transactions
  const allTxs = await context.entities.Transaction.findMany({
    where: {
      userId,
      date: {
        gte: new Date(startDate + "T00:00:00.000Z"),
        lte: new Date(endDate + "T23:59:59.999Z"),
      },
    },
  });

  let totalIncome = 0;
  let totalExpense = 0;

  for (const tx of allTxs) {
    if (tx.type === "INCOME") {
      totalIncome += tx.amount;
    } else if (tx.type === "EXPENSE") {
      totalExpense += tx.amount;
    }
  }

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  return {
    timeSeries,
    categoryBreakdown,
    summary: {
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate,
    },
  };
};
