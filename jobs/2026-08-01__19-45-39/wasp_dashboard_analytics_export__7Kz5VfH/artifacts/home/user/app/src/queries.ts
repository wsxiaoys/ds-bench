import { HttpError, prisma } from "wasp/server";
import type { GetAnalytics } from "wasp/server/operations";

type Resolution = "day" | "week" | "month";

type GetAnalyticsInput = {
  startDate: string;
  endDate: string;
  resolution: Resolution;
};

type TimeSeriesPoint = {
  date: string;
  income: number;
  expense: number;
  net: number;
};

type CategoryBreakdownPoint = {
  category: string;
  amount: number;
  type: "INCOME" | "EXPENSE";
};

type GetAnalyticsOutput = {
  timeSeries: TimeSeriesPoint[];
  categoryBreakdown: CategoryBreakdownPoint[];
  summary: {
    totalIncome: number;
    totalExpense: number;
    netSavings: number;
    savingsRate: number;
  };
};

// Prisma stores SQLite `DateTime` columns as integer Unix-epoch
// milliseconds, not as ISO-8601 text. SQLite's date/time functions expect
// either ISO-8601 text or a Julian day / Unix-epoch-seconds number, so we
// have to convert the raw column back into a normalized SQLite datetime
// value before we can use `date(...)`/`strftime(...)` on it.
const NORMALIZED_DATE = "datetime(date / 1000, 'unixepoch')";

// SQLite expressions used to bucket the (normalized) `date` column into the
// period string that identifies the aggregation bucket for the given
// resolution.
const PERIOD_EXPRESSIONS: Record<Resolution, string> = {
  day: `strftime('%Y-%m-%d', ${NORMALIZED_DATE})`,
  month: `strftime('%Y-%m', ${NORMALIZED_DATE})`,
  // ISO-8601 week ("YYYY-Www"): shift the date to the Thursday of its ISO
  // week (the well-known SQLite trick for ISO week calculations), then read
  // the ISO year off that Thursday and derive the week number from its
  // day-of-year.
  week:
    `(strftime('%Y', ${NORMALIZED_DATE}, '-3 days', 'weekday 4') || '-W' || ` +
    `substr('0' || ((CAST(strftime('%j', ${NORMALIZED_DATE}, '-3 days', 'weekday 4') AS INTEGER) - 1) / 7 + 1), -2, 2))`,
};

export const getAnalytics: GetAnalytics<
  GetAnalyticsInput,
  GetAnalyticsOutput
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const { startDate, endDate, resolution } = args;

  const periodExpr = PERIOD_EXPRESSIONS[resolution];
  if (!periodExpr) {
    throw new HttpError(400, "Invalid resolution");
  }

  const userId = context.user.id;

  const rawTimeSeries = await prisma.$queryRawUnsafe<
    Array<{ period: string; income: number | null; expense: number | null }>
  >(
    `SELECT ${periodExpr} as period,
            SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0.0 END) as income,
            SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0.0 END) as expense
     FROM "Transaction"
     WHERE userId = ? AND date(${NORMALIZED_DATE}) >= date(?) AND date(${NORMALIZED_DATE}) <= date(?)
     GROUP BY period
     ORDER BY period ASC`,
    userId,
    startDate,
    endDate
  );

  const timeSeries: TimeSeriesPoint[] = rawTimeSeries.map((row) => {
    const income = Number(row.income) || 0;
    const expense = Number(row.expense) || 0;
    return {
      date: row.period,
      income,
      expense,
      net: income - expense,
    };
  });

  const rawCategoryBreakdown = await prisma.$queryRawUnsafe<
    Array<{ category: string; type: string; amount: number | null }>
  >(
    `SELECT category, type, SUM(amount) as amount
     FROM "Transaction"
     WHERE userId = ? AND date(${NORMALIZED_DATE}) >= date(?) AND date(${NORMALIZED_DATE}) <= date(?)
     GROUP BY category, type
     ORDER BY category ASC`,
    userId,
    startDate,
    endDate
  );

  const categoryBreakdown: CategoryBreakdownPoint[] = rawCategoryBreakdown.map(
    (row) => ({
      category: row.category,
      amount: Number(row.amount) || 0,
      type: row.type as "INCOME" | "EXPENSE",
    })
  );

  const totalIncome = timeSeries.reduce((sum, point) => sum + point.income, 0);
  const totalExpense = timeSeries.reduce(
    (sum, point) => sum + point.expense,
    0
  );
  const netSavings = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0
      ? Math.round((netSavings / totalIncome) * 100 * 100) / 100
      : 0;

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
