import { useQuery, getAnalytics } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import type { AuthUser } from "wasp/auth";
import { useState } from "react";
import "./Main.css";

type Resolution = "day" | "week" | "month";

const DEFAULT_START_DATE = "2026-07-01";
const DEFAULT_END_DATE = "2026-07-31";
const DEFAULT_RESOLUTION: Resolution = "day";

function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Renders a plain (non-locale-formatted) number for CSV output, e.g. 5000
// instead of 5,000.00.
function csvNumber(value: number): string {
  return String(value);
}

function downloadCsv(fileName: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function MainPage({ user }: { user: AuthUser }) {
  const [startDate, setStartDate] = useState(DEFAULT_START_DATE);
  const [endDate, setEndDate] = useState(DEFAULT_END_DATE);
  const [resolution, setResolution] = useState<Resolution>(
    DEFAULT_RESOLUTION
  );

  const { data, isLoading, error } = useQuery(getAnalytics, {
    startDate,
    endDate,
    resolution,
  });

  const summary = data?.summary ?? {
    totalIncome: 0,
    totalExpense: 0,
    netSavings: 0,
    savingsRate: 0,
  };

  const timeSeries = data?.timeSeries ?? [];

  const handleExportCsv = () => {
    const rows = timeSeries
      .filter((point) => point.income !== 0 || point.expense !== 0)
      .slice()
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const lines = [
      "Date,Income,Expense,Net",
      ...rows.map(
        (point) =>
          `${point.date},${csvNumber(point.income)},${csvNumber(
            point.expense
          )},${csvNumber(point.net)}`
      ),
    ];

    downloadCsv("analytics_export.csv", lines.join("\n"));
  };

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <h1>Financial Analytics Dashboard</h1>
        <div className="user-info">
          <span>
            Signed in as <strong>{user.identities.username?.id ?? "user"}</strong>
          </span>
          <button
            type="button"
            id="logout-button"
            data-testid="logout-button"
            className="button-outlined"
            onClick={() => logout()}
          >
            Logout
          </button>
        </div>
      </header>

      <section className="controls">
        <div className="control">
          <label htmlFor="start-date">Start Date</label>
          <input
            type="date"
            id="start-date"
            data-testid="start-date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="control">
          <label htmlFor="end-date">End Date</label>
          <input
            type="date"
            id="end-date"
            data-testid="end-date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="control">
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
        <button
          type="button"
          id="export-csv"
          data-testid="export-csv"
          className="button-filled"
          onClick={handleExportCsv}
        >
          Export CSV
        </button>
      </section>

      {error && <p className="error-message">Failed to load analytics.</p>}

      <section className="summary">
        <div className="summary-card">
          <h3>Total Income</h3>
          <p data-testid="total-income">{formatCurrency(summary.totalIncome)}</p>
        </div>
        <div className="summary-card">
          <h3>Total Expense</h3>
          <p data-testid="total-expense">
            {formatCurrency(summary.totalExpense)}
          </p>
        </div>
        <div className="summary-card">
          <h3>Net Savings</h3>
          <p data-testid="net-savings">{formatCurrency(summary.netSavings)}</p>
        </div>
        <div className="summary-card">
          <h3>Savings Rate</h3>
          <p data-testid="savings-rate">{summary.savingsRate.toFixed(2)}%</p>
        </div>
      </section>

      <section className="table-section">
        <h2>Time Series</h2>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
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
              {timeSeries.length === 0 ? (
                <tr>
                  <td colSpan={4}>No data for the selected range.</td>
                </tr>
              ) : (
                timeSeries.map((point) => (
                  <tr key={point.date} data-testid="analytics-row">
                    <td data-testid="analytics-row-date">{point.date}</td>
                    <td data-testid="analytics-row-income">
                      {formatCurrency(point.income)}
                    </td>
                    <td data-testid="analytics-row-expense">
                      {formatCurrency(point.expense)}
                    </td>
                    <td data-testid="analytics-row-net">
                      {formatCurrency(point.net)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
