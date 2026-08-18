import { HttpError } from "wasp/server";
import { prisma } from "wasp/server";
import { type GetAnalytics, type CreateTransaction } from "wasp/server/operations";

export const getAnalytics: GetAnalytics<
  {
    startDate: string;
    endDate: string;
    resolution: "day" | "week" | "month";
  },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const { startDate, endDate, resolution } = args;
  const userId = context.user.id;

  const startISO = new Date(startDate + "T00:00:00.000Z");
  const endISO = new Date(endDate + "T23:59:59.999Z");

  const strftimeFormat = resolution === 'day' 
    ? "strftime('%Y-%m-%d', date)" 
    : resolution === 'month' 
      ? "strftime('%Y-%m', date)" 
      : "strftime('%Y-W%W', date)";

  // Raw query for time series
  const timeSeriesRaw = await prisma.$queryRawUnsafe(`
    SELECT 
      ${strftimeFormat} as formattedDate,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0.0 END) as income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0.0 END) as expense
    FROM "Transaction"
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
    GROUP BY formattedDate
    ORDER BY formattedDate ASC
  `, userId, startISO.toISOString(), endISO.toISOString());

  // Raw query for category breakdown
  const categoryBreakdownRaw = await prisma.$queryRawUnsafe(`
    SELECT 
      category,
      SUM(amount) as amount,
      type
    FROM "Transaction"
    WHERE userId = ?
      AND date >= ?
      AND date <= ?
    GROUP BY category, type
  `, userId, startISO.toISOString(), endISO.toISOString());

  // Parse time series results
  const timeSeries = (timeSeriesRaw as any[]).map((row) => {
    const income = Number(row.income || 0);
    const expense = Number(row.expense || 0);
    return {
      date: String(row.formattedDate),
      income,
      expense,
      net: income - expense,
    };
  });

  // Parse category breakdown
  const categoryBreakdown = (categoryBreakdownRaw as any[]).map((row) => ({
    category: String(row.category),
    amount: Number(row.amount || 0),
    type: String(row.type) as "INCOME" | "EXPENSE",
  }));

  // Calculate summary
  let totalIncome = 0;
  let totalExpense = 0;

  timeSeries.forEach((item) => {
    totalIncome += item.income;
    totalExpense += item.expense;
  });

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

export const createTransaction: CreateTransaction<
  {
    date: string;
    amount: number;
    type: "INCOME" | "EXPENSE";
    category: string;
    description: string;
  },
  any
> = async (args, context) => {
  if (!context.user) {
    throw new HttpError(401, "Unauthorized");
  }

  const { date, amount, type, category, description } = args;

  const newTransaction = await context.entities.Transaction.create({
    data: {
      date: new Date(date + "T12:00:00.000Z"), // mid-day to avoid TZ boundary issues
      amount,
      type,
      category,
      description,
      userId: context.user.id,
    },
  });

  return newTransaction;
};
