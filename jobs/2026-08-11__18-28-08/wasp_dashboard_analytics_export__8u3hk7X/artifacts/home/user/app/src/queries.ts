import { HttpError } from "wasp/server"

export const getAnalytics = async (args: any, context: any) => {
  if (!context.user) {
    throw new HttpError(401, "User is not authenticated")
  }

  const userId = context.user.id;
  const { startDate, endDate, resolution } = args;

  if (!startDate || !endDate || !resolution) {
    throw new HttpError(400, "Missing required arguments: startDate, endDate, resolution")
  }

  let dateFormat = '%Y-%m-%d';
  if (resolution === 'month') {
    dateFormat = '%Y-%m';
  } else if (resolution === 'week') {
    dateFormat = '%Y-W%W';
  }

  // Get aggregated time series
  const timeSeriesRaw: any[] = await context.entities.Transaction.$queryRawUnsafe(`
    SELECT 
      strftime(?, CASE 
        WHEN typeof(date) = 'integer' THEN datetime(date / 1000, 'unixepoch')
        WHEN typeof(date) = 'real' THEN datetime(date / 1000, 'unixepoch')
        ELSE datetime(date)
      END) as formattedDate,
      SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0.0 END) as income,
      SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0.0 END) as expense
    FROM "Transaction"
    WHERE userId = ?
      AND strftime('%Y-%m-%d', CASE 
        WHEN typeof(date) = 'integer' THEN datetime(date / 1000, 'unixepoch')
        WHEN typeof(date) = 'real' THEN datetime(date / 1000, 'unixepoch')
        ELSE datetime(date)
      END) >= ?
      AND strftime('%Y-%m-%d', CASE 
        WHEN typeof(date) = 'integer' THEN datetime(date / 1000, 'unixepoch')
        WHEN typeof(date) = 'real' THEN datetime(date / 1000, 'unixepoch')
        ELSE datetime(date)
      END) <= ?
    GROUP BY formattedDate
    ORDER BY formattedDate ASC
  `, dateFormat, userId, startDate, endDate);

  // Get category breakdown
  const categoryBreakdownRaw: any[] = await context.entities.Transaction.$queryRawUnsafe(`
    SELECT 
      category,
      SUM(amount) as amount,
      type
    FROM "Transaction"
    WHERE userId = ?
      AND strftime('%Y-%m-%d', CASE 
        WHEN typeof(date) = 'integer' THEN datetime(date / 1000, 'unixepoch')
        WHEN typeof(date) = 'real' THEN datetime(date / 1000, 'unixepoch')
        ELSE datetime(date)
      END) >= ?
      AND strftime('%Y-%m-%d', CASE 
        WHEN typeof(date) = 'integer' THEN datetime(date / 1000, 'unixepoch')
        WHEN typeof(date) = 'real' THEN datetime(date / 1000, 'unixepoch')
        ELSE datetime(date)
      END) <= ?
    GROUP BY category, type
  `, userId, startDate, endDate);

  let totalIncome = 0;
  let totalExpense = 0;

  const timeSeries = timeSeriesRaw.map((row: any) => {
    const income = Number(row.income || 0);
    const expense = Number(row.expense || 0);
    const net = income - expense;
    totalIncome += income;
    totalExpense += expense;
    return {
      date: row.formattedDate,
      income,
      expense,
      net,
    };
  });

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  const categoryBreakdown = categoryBreakdownRaw.map((row: any) => ({
    category: row.category,
    amount: Number(row.amount || 0),
    type: row.type as "INCOME" | "EXPENSE",
  }));

  const summary = {
    totalIncome,
    totalExpense,
    netSavings,
    savingsRate,
  };

  return {
    timeSeries,
    categoryBreakdown,
    summary,
  };
};
