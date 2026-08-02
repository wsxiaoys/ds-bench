import { useState, useMemo } from "react";
import { useQuery } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import { getAnalytics } from "wasp/client/operations";
import "./Main.css";

type Resolution = "day" | "week" | "month";

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function exportToCsv(
  timeSeries: Array<{ date: string; income: number; expense: number; net: number }>
) {
  const headers = "Date,Income,Expense,Net";
  const rows = timeSeries
    .filter((row) => row.income !== 0 || row.expense !== 0)
    .map(
      (row) =>
        `${row.date},${row.income},${row.expense},${row.net}`
    );

  const csv = [headers, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "analytics_export.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function MainPage() {
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [resolution, setResolution] = useState<Resolution>("day");

  const { data, isLoading, error } = useQuery(getAnalytics, {
    startDate,
    endDate,
    resolution,
  });

  const analytics = useMemo(() => {
    if (!data) return null;
    return data;
  }, [data]);

  return (
    <main className="dashboard-container">
      <header className="dashboard-header">
        <h1>Financial Analytics Dashboard</h1>
        <button
          className="logout-btn"
          onClick={() => logout()}
        >
          Logout
        </button>
      </header>

      <section className="filters">
        <div className="filter-group">
          <label htmlFor="start-date">Start Date</label>
          <input
            type="date"
            id="start-date"
            data-testid="start-date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="end-date">End Date</label>
          <input
            type="date"
            id="end-date"
            data-testid="end-date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label htmlFor="resolution">Resolution</label>
          <select
            id="resolution"
            data-testid="resolution"
            value={resolution}
            onChange={(e) => setResolution(e.target.value as Resolution)}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
      </section>

      {isLoading && <p className="loading">Loading analytics...</p>}
      {error && <p className="error">Error loading analytics: {error.message}</p>}

      {analytics && (
        <>
          <section className="summary-cards">
            <div className="summary-card income">
              <h3>Total Income</h3>
              <p className="summary-value" data-testid="total-income">
                ${formatCurrency(analytics.summary.totalIncome)}
              </p>
            </div>
            <div className="summary-card expense">
              <h3>Total Expense</h3>
              <p className="summary-value" data-testid="total-expense">
                ${formatCurrency(analytics.summary.totalExpense)}
              </p>
            </div>
            <div className="summary-card net">
              <h3>Net Savings</h3>
              <p className="summary-value" data-testid="net-savings">
                ${formatCurrency(analytics.summary.netSavings)}
              </p>
            </div>
            <div className="summary-card rate">
              <h3>Savings Rate</h3>
              <p className="summary-value" data-testid="savings-rate">
                {analytics.summary.savingsRate.toFixed(2)}%
              </p>
            </div>
          </section>

          <section className="table-section">
            <div className="table-header">
              <h2>Analytics Table</h2>
              <button
                id="export-csv"
                data-testid="export-csv"
                className="export-btn"
                onClick={() => exportToCsv(analytics.timeSeries)}
              >
                Export CSV
              </button>
            </div>

            <div className="table-wrapper">
              <table data-testid="analytics-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Income</th>
                    <th>Expense</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.timeSeries
                    .filter((row) => row.income !== 0 || row.expense !== 0)
                    .map((row) => (
                      <tr key={row.date} data-testid="analytics-row">
                        <td>{row.date}</td>
                        <td>${formatCurrency(row.income)}</td>
                        <td>${formatCurrency(row.expense)}</td>
                        <td className={row.net >= 0 ? "positive" : "negative"}>
                          ${formatCurrency(row.net)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          {analytics.categoryBreakdown.length > 0 && (
            <section className="category-section">
              <h2>Category Breakdown</h2>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.categoryBreakdown.map((row, idx) => (
                      <tr key={`${row.category}-${row.type}-${idx}`}>
                        <td>{row.category}</td>
                        <td>{row.type}</td>
                        <td>${formatCurrency(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
