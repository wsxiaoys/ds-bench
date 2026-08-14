import type { GetAnalytics } from "wasp/server/operations";
import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";

type GetAnalyticsArgs = {
  startDate: string;
  endDate: string;
  resolution: "day" | "week" | "month";
};

export const getAnalytics: GetAnalytics<GetAnalyticsArgs, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const startMs = new Date(args.startDate + "T00:00:00.000Z").getTime();
  const endMs = new Date(args.endDate + "T23:59:59.999Z").getTime();

  let formatString = "%Y-%m-%d";
  if (args.resolution === "month") {
    formatString = "%Y-%m";
  } else if (args.resolution === "week") {
    formatString = "%Y-W%W";
  }

  // Fetch time-series aggregation
  const timeSeriesRaw = await prisma.$queryRaw<any[]>`
    SELECT 
      strftime(${formatString}, date / 1000, 'unixepoch') as dateGroup,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0.0 END) as income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0.0 END) as expense
    FROM "Transaction"
    WHERE userId = ${context.user.id} AND date >= ${startMs} AND date <= ${endMs}
    GROUP BY dateGroup
    ORDER BY dateGroup ASC
  `;

  const timeSeries = timeSeriesRaw.map((row) => {
    const income = Number(row.income || 0);
    const expense = Number(row.expense || 0);
    return {
      date: row.dateGroup,
      income,
      expense,
      net: income - expense,
    };
  });

  // Fetch category breakdown
  const categoryBreakdownRaw = await prisma.$queryRaw<any[]>`
    SELECT 
      category,
      SUM(amount) as amount,
      type
    FROM "Transaction"
    WHERE userId = ${context.user.id} AND date >= ${startMs} AND date <= ${endMs}
    GROUP BY category, type
    ORDER BY amount DESC
  `;

  const categoryBreakdown = categoryBreakdownRaw.map((row) => ({
    category: row.category,
    amount: Number(row.amount || 0),
    type: row.type as "INCOME" | "EXPENSE",
  }));

  // Calculate summary
  let totalIncome = 0;
  let totalExpense = 0;

  for (const item of timeSeries) {
    totalIncome += item.income;
    totalExpense += item.expense;
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
