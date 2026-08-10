import type { GetAnalytics } from "wasp/server/operations";
import { prisma } from "wasp/server";

type AnalyticsInput = {
  startDate: string;
  endDate: string;
  resolution: "day" | "week" | "month";
};

type TimeSeriesRow = {
  date: string;
  income: number;
  expense: number;
  net: number;
};

type CategoryBreakdownRow = {
  category: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
};

type AnalyticsOutput = {
  timeSeries: TimeSeriesRow[];
  categoryBreakdown: CategoryBreakdownRow[];
  summary: {
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    savingsRate: number;
  };
};

export const getAnalytics: GetAnalytics<AnalyticsInput, AnalyticsOutput> = async (
  { startDate, endDate, resolution },
  context
) => {
  const userId = context.user?.id;
  if (!userId) {
    throw new Error("Not authenticated");
  }

  // Build the date format expression based on resolution
  let dateExpr: string;
  switch (resolution) {
    case "day":
      dateExpr = "strftime('%Y-%m-%d', date)";
      break;
    case "week":
      // SQLite week: %W gives week number (00-53), starting on Monday
      dateExpr = "strftime('%Y-W%W', date)";
      break;
    case "month":
      dateExpr = "strftime('%Y-%m', date)";
      break;
  }

  const timeSeriesQuery = `
    SELECT
      ${dateExpr} as date,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as expense,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END) as net
    FROM Transaction
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
    GROUP BY date
    ORDER BY date ASC
  `;

  const categoryBreakdownQuery = `
    SELECT
      category,
      SUM(amount) as amount,
      type
    FROM Transaction
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
    GROUP BY category, type
    ORDER BY type, amount DESC
  `;

  const summaryQuery = `
    SELECT
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) as totalIncome,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as totalExpense
    FROM Transaction
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
  `;

  const startDateStr = startDate + "T00:00:00.000Z";
  const endDateStr = endDate + "T23:59:59.999Z";

  const timeSeriesResult = await prisma.$queryRawUnsafe(
    timeSeriesQuery,
    userId,
    startDateStr,
    endDateStr
  ) as TimeSeriesRow[];

  const categoryBreakdownResult = await prisma.$queryRawUnsafe(
    categoryBreakdownQuery,
    userId,
    startDateStr,
    endDateStr
  ) as CategoryBreakdownRow[];

  const summaryResult = await prisma.$queryRawUnsafe(
    summaryQuery,
    userId,
    startDateStr,
    endDateStr
  ) as Array<{ totalIncome: number | null; totalExpense: number | null }>;

  const totalIncome = summaryResult[0]?.totalIncome ?? 0;
  const totalExpense = summaryResult[0]?.totalExpense ?? 0;
  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  return {
    timeSeries: timeSeriesResult,
    categoryBreakdown: categoryBreakdownResult,
    summary: {
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate,
    },
  };
};
