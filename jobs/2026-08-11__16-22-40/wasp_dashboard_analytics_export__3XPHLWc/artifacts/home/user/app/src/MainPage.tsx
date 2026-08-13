import React, { useState } from "react";
import { logout, useAuth } from "wasp/client/auth";
import { useQuery, useAction, getAnalytics, createTransaction } from "wasp/client/operations";
import "./Main.css";

export function MainPage() {
  const { data: user } = useAuth();
  
  // Date filters state with default values
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [resolution, setResolution] = useState<"day" | "week" | "month">("day");

  // Form state for creating a transaction
  const [txDate, setTxDate] = useState("2026-07-01");
  const [txAmount, setTxAmount] = useState("");
  const [txType, setTxType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [txCategory, setTxCategory] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txError, setTxError] = useState("");
  const [txSuccess, setTxSuccess] = useState("");

  // Fetch analytics data using the Wasp query
  const { data: analyticsData, isLoading, error } = useQuery(getAnalytics, {
    startDate,
    endDate,
    resolution,
  });

  // Action for creating a transaction
  const createTxAction = useAction(createTransaction);

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError("");
    setTxSuccess("");

    if (!txDate || !txAmount || !txCategory) {
      setTxError("Please fill in all required fields.");
      return;
    }

    const parsedAmount = parseFloat(txAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTxError("Amount must be a positive number.");
      return;
    }

    try {
      await createTxAction({
        date: txDate,
        amount: parsedAmount,
        type: txType,
        category: txCategory,
        description: txDescription,
      });
      setTxSuccess("Transaction created successfully!");
      // Reset form
      setTxAmount("");
      setTxCategory("");
      setTxDescription("");
    } catch (err: any) {
      setTxError(err.message || "Failed to create transaction.");
    }
  };

  const handleExportCSV = () => {
    if (!analyticsData || !analyticsData.timeSeries) return;

    // Filter rows with non-zero activity (income or expense > 0)
    const filteredRows = analyticsData.timeSeries.filter(
      (row: any) => row.income !== 0 || row.expense !== 0
    );

    // Generate CSV content
    const headers = ["Date", "Income", "Expense", "Net"];
    const csvRows = [headers.join(",")];

    filteredRows.forEach((row: any) => {
      csvRows.push([row.date, row.income, row.expense, row.net].join(","));
    });

    const csvContent = csvRows.join("\n");
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

  // Safe formatting helpers for currency and percentage
  const formatCurrency = (val: number) => {
    return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPercent = (val: number) => {
    return val.toFixed(2);
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Financial Analytics Dashboard</h1>
          {user && <p className="welcome-message">Logged in as: <strong>{user.identities.username?.id || "User"}</strong></p>}
        </div>
        <button onClick={logout} className="logout-btn">Logout</button>
      </header>

      <main className="dashboard-main">
        {/* Filter Controls */}
        <section className="controls-card">
          <h2>Filter Controls</h2>
          <div className="controls-grid">
            <div className="control-group">
              <label htmlFor="start-date">Start Date</label>
              <input
                type="date"
                id="start-date"
                data-testid="start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="control-group">
              <label htmlFor="end-date">End Date</label>
              <input
                type="date"
                id="end-date"
                data-testid="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="control-group">
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
            <div className="control-group export-group">
              <button
                id="export-csv"
                data-testid="export-csv"
                onClick={handleExportCSV}
                className="export-btn"
                disabled={!analyticsData || analyticsData.timeSeries.length === 0}
              >
                Export CSV
              </button>
            </div>
          </div>
        </section>

        {/* Loading and Error States */}
        {isLoading && <div className="loading-state">Loading financial data...</div>}
        {error && <div className="error-state">Error loading data: {error.message || "Unknown error"}</div>}

        {/* Summary Cards */}
        {analyticsData && (
          <>
            <section className="summary-grid">
              <div className="summary-card income">
                <h3>Total Income</h3>
                <p data-testid="total-income" className="summary-value">
                  ${formatCurrency(analyticsData.summary.totalIncome)}
                </p>
              </div>
              <div className="summary-card expense">
                <h3>Total Expense</h3>
                <p data-testid="total-expense" className="summary-value">
                  ${formatCurrency(analyticsData.summary.totalExpense)}
                </p>
              </div>
              <div className="summary-card net">
                <h3>Net Savings</h3>
                <p data-testid="net-savings" className="summary-value">
                  ${formatCurrency(analyticsData.summary.netSavings)}
                </p>
              </div>
              <div className="summary-card rate">
                <h3>Savings Rate</h3>
                <p data-testid="savings-rate" className="summary-value">
                  {formatPercent(analyticsData.summary.savingsRate)}%
                </p>
              </div>
            </section>

            {/* Main Content Grid: Table and Category Breakdown */}
            <div className="content-grid">
              {/* Time-Series Table */}
              <section className="table-card">
                <h2>Time Series Aggregation</h2>
                <div className="table-wrapper">
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
                      {analyticsData.timeSeries.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="empty-table">No transaction data available for this range.</td>
                        </tr>
                      ) : (
                        analyticsData.timeSeries.map((row: any) => (
                          <tr key={row.date} data-testid="analytics-row">
                            <td className="date-col">{row.date}</td>
                            <td className="income-col">${formatCurrency(row.income)}</td>
                            <td className="expense-col">${formatCurrency(row.expense)}</td>
                            <td className={`net-col ${row.net >= 0 ? "positive" : "negative"}`}>
                              ${formatCurrency(row.net)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Category Breakdown & Add Transaction */}
              <div className="side-panel">
                <section className="breakdown-card">
                  <h2>Category Breakdown</h2>
                  <ul className="breakdown-list">
                    {analyticsData.categoryBreakdown.length === 0 ? (
                      <li className="empty-breakdown">No category data.</li>
                    ) : (
                      analyticsData.categoryBreakdown.map((item: any, idx: number) => (
                        <li key={idx} className="breakdown-item">
                          <span className="breakdown-category">{item.category}</span>
                          <span className={`breakdown-amount ${item.type.toLowerCase()}`}>
                            {item.type === "INCOME" ? "+" : "-"}${formatCurrency(item.amount)}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </section>

                <section className="form-card">
                  <h2>Add Transaction</h2>
                  <form onSubmit={handleCreateTransaction} className="transaction-form">
                    <div className="form-group">
                      <label htmlFor="tx-date">Date *</label>
                      <input
                        type="date"
                        id="tx-date"
                        value={txDate}
                        onChange={(e) => setTxDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="tx-amount">Amount ($) *</label>
                      <input
                        type="number"
                        id="tx-amount"
                        step="0.01"
                        placeholder="0.00"
                        value={txAmount}
                        onChange={(e) => setTxAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="tx-type">Type *</label>
                      <select
                        id="tx-type"
                        value={txType}
                        onChange={(e) => setTxType(e.target.value as any)}
                        required
                      >
                        <option value="INCOME">Income</option>
                        <option value="EXPENSE">Expense</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="tx-category">Category *</label>
                      <input
                        type="text"
                        id="tx-category"
                        placeholder="e.g. Food, Salary, Software"
                        value={txCategory}
                        onChange={(e) => setTxCategory(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="tx-description">Description</label>
                      <input
                        type="text"
                        id="tx-description"
                        placeholder="Optional details"
                        value={txDescription}
                        onChange={(e) => setTxDescription(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="submit-btn">Add Transaction</button>
                    {txError && <p className="form-error">{txError}</p>}
                    {txSuccess && <p className="form-success">{txSuccess}</p>}
                  </form>
                </section>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
