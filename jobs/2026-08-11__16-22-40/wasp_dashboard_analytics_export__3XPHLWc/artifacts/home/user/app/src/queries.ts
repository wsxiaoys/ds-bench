import { HttpError } from "wasp/server";

export const getAnalytics = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User not authenticated");
  }

  const { startDate, endDate, resolution } = args;

  if (!startDate || !endDate || !resolution) {
    throw new HttpError(400, "Missing required parameters");
  }

  const userId = context.user.id;

  // Define date format based on resolution
  let dateFormat = "%Y-%m-%d";
  if (resolution === "month") {
    dateFormat = "%Y-%m";
  } else if (resolution === "week") {
    dateFormat = "%Y-W%W";
  } else if (resolution === "day") {
    dateFormat = "%Y-%m-%d";
  } else {
    throw new HttpError(400, "Invalid resolution");
  }

  // Time-series aggregation using Prisma raw query
  const timeSeriesRaw = await context.entities.Transaction.$queryRawUnsafe(
    `SELECT 
      strftime('${dateFormat}', date) as date,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0.0 END) as income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0.0 END) as expense
     FROM "Transaction"
     WHERE userId = ? AND strftime('%Y-%m-%d', date) >= ? AND strftime('%Y-%m-%d', date) <= ?
     GROUP BY date
     ORDER BY date ASC`,
    userId,
    startDate,
    endDate
  );

  const timeSeries = (timeSeriesRaw as any[]).map((row) => {
    const income = Number(row.income || 0);
    const expense = Number(row.expense || 0);
    return {
      date: row.date,
      income,
      expense,
      net: income - expense,
    };
  });

  // Category breakdown raw query
  const categoryBreakdownRaw = await context.entities.Transaction.$queryRawUnsafe(
    `SELECT 
      category,
      SUM(amount) as amount,
      type
     FROM "Transaction"
     WHERE userId = ? AND strftime('%Y-%m-%d', date) >= ? AND strftime('%Y-%m-%d', date) <= ?
     GROUP BY category, type`,
    userId,
    startDate,
    endDate
  );

  const categoryBreakdown = (categoryBreakdownRaw as any[]).map((row) => ({
    category: row.category,
    amount: Number(row.amount || 0),
    type: row.type as "INCOME" | "EXPENSE",
  }));

  // Calculate summary
  let totalIncome = 0;
  let totalExpense = 0;

  categoryBreakdown.forEach((item) => {
    if (item.type === "INCOME") {
      totalIncome += item.amount;
    } else if (item.type === "EXPENSE") {
      totalExpense += item.amount;
    }
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
