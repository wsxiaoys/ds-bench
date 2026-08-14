import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";
import type { GetAnalytics } from "wasp/server/operations";

export const getAnalytics: GetAnalytics<{
  startDate: string;
  endDate: string;
  resolution: "day" | "week" | "month";
}, any> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const { startDate, endDate, resolution } = args;
  const userId = context.user.id;

  const start = new Date(startDate + "T00:00:00.000Z");
  const end = new Date(endDate + "T23:59:59.999Z");
  const startMillis = start.getTime();
  const endMillis = end.getTime();
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  // 1. Time-series aggregation using Prisma raw query
  const rawRows: any[] = await prisma.$queryRaw`
    SELECT 
      CASE 
        WHEN typeof(date) = 'integer' OR typeof(date) = 'real' THEN
          CASE ${resolution}
            WHEN 'day' THEN strftime('%Y-%m-%d', date / 1000.0, 'unixepoch')
            WHEN 'month' THEN strftime('%Y-%m', date / 1000.0, 'unixepoch')
            WHEN 'week' THEN strftime('%Y-W%W', date / 1000.0, 'unixepoch')
          END
        ELSE
          CASE ${resolution}
            WHEN 'day' THEN strftime('%Y-%m-%d', date)
            WHEN 'month' THEN strftime('%Y-%m', date)
            WHEN 'week' THEN strftime('%Y-W%W', date)
          END
      END as aggDate,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as expense
    FROM "Transaction"
    WHERE userId = ${userId}
      AND (
        (typeof(date) = 'integer' AND date >= ${startMillis} AND date <= ${endMillis})
        OR
        (typeof(date) <> 'integer' AND date >= ${startIso} AND date <= ${endIso})
        OR
        (date >= ${start} AND date <= ${end})
      )
    GROUP BY aggDate
    ORDER BY aggDate ASC
  `;

  const timeSeries = rawRows.map((row: any) => {
    const income = Number(row.income || 0);
    const expense = Number(row.expense || 0);
    return {
      date: row.aggDate,
      income,
      expense,
      net: income - expense,
    };
  });

  // 2. Category breakdown using Prisma raw query
  const categoryRows: any[] = await prisma.$queryRaw`
    SELECT 
      category,
      SUM(amount) as amount,
      type
    FROM "Transaction"
    WHERE userId = ${userId}
      AND (
        (typeof(date) = 'integer' AND date >= ${startMillis} AND date <= ${endMillis})
        OR
        (typeof(date) <> 'integer' AND date >= ${startIso} AND date <= ${endIso})
        OR
        (date >= ${start} AND date <= ${end})
      )
    GROUP BY category, type
  `;

  const categoryBreakdown = categoryRows.map((row: any) => ({
    category: row.category,
    amount: Number(row.amount || 0),
    type: row.type as "INCOME" | "EXPENSE",
  }));

  // 3. Compute Summary
  const totalIncome = timeSeries.reduce((sum, item) => sum + item.income, 0);
  const totalExpense = timeSeries.reduce((sum, item) => sum + item.expense, 0);
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
