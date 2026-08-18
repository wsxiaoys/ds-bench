import { useState } from "react";
import { useQuery, createTransaction } from "wasp/client/operations";
import { getAnalytics } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import "./Main.css";

export function MainPage() {
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [resolution, setResolution] = useState<"day" | "week" | "month">("day");

  // Transaction Form State
  const [txDate, setTxDate] = useState("2026-07-01");
  const [txAmount, setTxTxAmount] = useState("");
  const [txType, setTxType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [txCategory, setTxCategory] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [formMessage, setFormMessage] = useState("");

  const { data: analytics, isLoading, error, refetch } = useQuery(getAnalytics, {
    startDate,
    endDate,
    resolution,
  });

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || !txCategory || !txDescription) {
      setFormMessage("Please fill out all fields.");
      return;
    }

    try {
      await createTransaction({
        date: txDate,
        amount: parseFloat(txAmount),
        type: txType,
        category: txCategory,
        description: txDescription,
      });
      setFormMessage("Transaction added successfully!");
      // Reset form
      setTxTxAmount("");
      setTxCategory("");
      setTxDescription("");
      // Refetch analytics data
      refetch();
    } catch (err: any) {
      setFormMessage("Error adding transaction: " + err.message);
    }
  };

  const handleExportCSV = () => {
    if (!analytics || !analytics.timeSeries) return;

    // Filter and sort
    const rows = analytics.timeSeries
      .filter((row: any) => row.income !== 0 || row.expense !== 0)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    // Build CSV string
    let csvContent = "Date,Income,Expense,Net\n";
    for (const row of rows) {
      csvContent += `${row.date},${row.income},${row.expense},${row.net}\n`;
    }

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "analytics_export.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Financial Analytics Dashboard</h1>
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </header>

      <div className="dashboard-grid">
        {/* Sidebar Controls */}
        <aside className="sidebar-card">
          <h2>Filters</h2>
          <div className="form-group">
            <label htmlFor="start-date">Start Date</label>
            <input
              type="date"
              id="start-date"
              data-testid="start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="end-date">End Date</label>
            <input
              type="date"
              id="end-date"
              data-testid="end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label htmlFor="resolution">Resolution</label>
            <select
              id="resolution"
              data-testid="resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value as any)}
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
            </select>
          </div>

          <button
            id="export-csv"
            data-testid="export-csv"
            className="btn btn-primary"
            onClick={handleExportCSV}
            disabled={!analytics}
          >
            Export CSV
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="main-content">
          {/* Summary Cards */}
          <section className="summary-cards">
            <div className="card">
              <h3>Total Income</h3>
              <p className="amount income" data-testid="total-income">
                ${analytics ? analytics.summary.totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </p>
            </div>
            <div className="card">
              <h3>Total Expense</h3>
              <p className="amount expense" data-testid="total-expense">
                ${analytics ? analytics.summary.totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </p>
            </div>
            <div className="card">
              <h3>Net Savings</h3>
              <p className={`amount ${analytics && analytics.summary.netSavings >= 0 ? "income" : "expense"}`} data-testid="net-savings">
                ${analytics ? analytics.summary.netSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
              </p>
            </div>
            <div className="card">
              <h3>Savings Rate</h3>
              <p className="amount rate" data-testid="savings-rate">
                {analytics ? analytics.summary.savingsRate.toFixed(2) : "0.00"}%
              </p>
            </div>
          </section>

          {/* Time Series Table */}
          <section className="table-card">
            <h2>Time-Series History</h2>
            {isLoading && <p>Loading analytics...</p>}
            {error && <p className="error-text">Error loading data: {error.message}</p>}
            {analytics && (
              <div className="table-responsive">
                <table data-testid="analytics-table" className="analytics-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Income</th>
                      <th>Expense</th>
                      <th>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.timeSeries.map((row: any) => (
                      <tr key={row.date} data-testid="analytics-row">
                        <td>{row.date}</td>
                        <td className="income">${row.income.toFixed(2)}</td>
                        <td className="expense">${row.expense.toFixed(2)}</td>
                        <td className={row.net >= 0 ? "income" : "expense"}>
                          ${row.net.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {analytics.timeSeries.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ textAlign: "center" }}>
                          No transactions found for the selected range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Category Breakdown */}
          {analytics && analytics.categoryBreakdown.length > 0 && (
            <section className="breakdown-card">
              <h2>Category Breakdown</h2>
              <div className="category-list">
                {analytics.categoryBreakdown.map((item: any, idx: number) => (
                  <div key={idx} className="category-item">
                    <span className="category-name">{item.category} ({item.type})</span>
                    <span className={`category-amount ${item.type === "INCOME" ? "income" : "expense"}`}>
                      ${item.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Add Transaction Form */}
          <section className="form-card">
            <h2>Add New Transaction</h2>
            <form onSubmit={handleAddTransaction} className="transaction-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tx-date">Date</label>
                  <input
                    type="date"
                    id="tx-date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="tx-amount">Amount</label>
                  <input
                    type="number"
                    id="tx-amount"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={txAmount}
                    onChange={(e) => setTxTxAmount(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="tx-type">Type</label>
                  <select
                    id="tx-type"
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as any)}
                  >
                    <option value="INCOME">Income</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="tx-category">Category</label>
                  <input
                    type="text"
                    id="tx-category"
                    placeholder="e.g. Food, Salary, Software"
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="tx-description">Description</label>
                <input
                  type="text"
                  id="tx-description"
                  placeholder="e.g. Weekly groceries"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary">
                Add Transaction
              </button>

              {formMessage && <p className="form-message">{formMessage}</p>}
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}
