import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";
import type { GetAnalytics } from "wasp/server/operations";

export const getAnalytics: GetAnalytics<
  { startDate: string; endDate: string; resolution: "day" | "week" | "month" },
  {
    timeSeries: Array<{
      date: string;
      income: number;
      expense: number;
      net: number;
    }>;
    categoryBreakdown: Array<{
      category: string;
      amount: number;
      type: "INCOME" | "EXPENSE";
    }>;
    summary: {
      totalIncome: number;
      totalExpense: number;
      netSavings: number;
      savingsRate: number;
    };
  }
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const userId = context.user.id;
  const { startDate, endDate, resolution } = args;

  // 1. Time-series aggregation using raw query on SQLite
  // We handle both integer (milliseconds since epoch) and text (ISO 8601 string) representations of date.
  const rawTimeSeries: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      CASE
        WHEN '${resolution}' = 'day' THEN
          CASE
            WHEN typeof(date) = 'integer' OR typeof(date) = 'real' THEN strftime('%Y-%m-%d', date / 1000, 'unixepoch')
            ELSE strftime('%Y-%m-%d', date)
          END
        WHEN '${resolution}' = 'week' THEN
          CASE
            WHEN typeof(date) = 'integer' OR typeof(date) = 'real' THEN strftime('%Y-W%W', date / 1000, 'unixepoch')
            ELSE strftime('%Y-W%W', date)
          END
        WHEN '${resolution}' = 'month' THEN
          CASE
            WHEN typeof(date) = 'integer' OR typeof(date) = 'real' THEN strftime('%Y-%m', date / 1000, 'unixepoch')
            ELSE strftime('%Y-%m', date)
          END
      END as date,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0.0 END) as income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0.0 END) as expense,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END) as net
    FROM "Transaction"
    WHERE userId = ${userId}
      AND CASE
        WHEN typeof(date) = 'integer' OR typeof(date) = 'real' THEN strftime('%Y-%m-%d', date / 1000, 'unixepoch')
        ELSE strftime('%Y-%m-%d', date)
      END >= '${startDate}'
      AND CASE
        WHEN typeof(date) = 'integer' OR typeof(date) = 'real' THEN strftime('%Y-%m-%d', date / 1000, 'unixepoch')
        ELSE strftime('%Y-%m-%d', date)
      END <= '${endDate}'
    GROUP BY date
    ORDER BY date ASC
  `);

  const timeSeries = rawTimeSeries.map((row) => ({
    date: String(row.date),
    income: Number(row.income || 0),
    expense: Number(row.expense || 0),
    net: Number(row.net || 0),
  }));

  // 2. Category breakdown aggregation
  const rawCategoryBreakdown: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      category,
      SUM(amount) as amount,
      type
    FROM "Transaction"
    WHERE userId = ${userId}
      AND CASE
        WHEN typeof(date) = 'integer' OR typeof(date) = 'real' THEN strftime('%Y-%m-%d', date / 1000, 'unixepoch')
        ELSE strftime('%Y-%m-%d', date)
      END >= '${startDate}'
      AND CASE
        WHEN typeof(date) = 'integer' OR typeof(date) = 'real' THEN strftime('%Y-%m-%d', date / 1000, 'unixepoch')
        ELSE strftime('%Y-%m-%d', date)
      END <= '${endDate}'
    GROUP BY category, type
  `);

  const categoryBreakdown = rawCategoryBreakdown.map((row) => ({
    category: String(row.category),
    amount: Number(row.amount || 0),
    type: String(row.type) as "INCOME" | "EXPENSE",
  }));

  // 3. Summary metrics
  let totalIncome = 0;
  let totalExpense = 0;

  // To ensure the summary includes all activity in the date range,
  // we can sum the non-grouped transaction values.
  const rawSummary: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0.0 END) as totalIncome,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0.0 END) as totalExpense
    FROM "Transaction"
    WHERE userId = ${userId}
      AND CASE
        WHEN typeof(date) = 'integer' OR typeof(date) = 'real' THEN strftime('%Y-%m-%d', date / 1000, 'unixepoch')
        ELSE strftime('%Y-%m-%d', date)
      END >= '${startDate}'
      AND CASE
        WHEN typeof(date) = 'integer' OR typeof(date) = 'real' THEN strftime('%Y-%m-%d', date / 1000, 'unixepoch')
        ELSE strftime('%Y-%m-%d', date)
      END <= '${endDate}'
  `);

  if (rawSummary && rawSummary.length > 0) {
    totalIncome = Number(rawSummary[0].totalIncome || 0);
    totalExpense = Number(rawSummary[0].totalExpense || 0);
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
