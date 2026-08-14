import React, { useState } from "react";
import { useQuery, getAnalytics, createTransaction } from "wasp/client/operations";
import { useAuth, logout } from "wasp/client/auth";

export function MainPage() {
  const { data: user } = useAuth();

  // State for date filters and resolution
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [resolution, setResolution] = useState<"day" | "week" | "month">("day");

  // State for creating a transaction
  const [txDate, setTxDate] = useState("2026-07-01");
  const [txAmount, setTxAmount] = useState("");
  const [txType, setTxType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [txCategory, setTxCategory] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txError, setTxError] = useState("");
  const [txSuccess, setTxSuccess] = useState("");

  // Fetch analytics data using useQuery
  const { data: analytics, isLoading, error } = useQuery(getAnalytics, {
    startDate,
    endDate,
    resolution,
  });

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxError("");
    setTxSuccess("");

    if (!txDate || !txAmount || !txCategory || !txDescription) {
      setTxError("All fields are required.");
      return;
    }

    const amountNum = parseFloat(txAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setTxError("Amount must be a positive number.");
      return;
    }

    try {
      await createTransaction({
        date: txDate,
        amount: amountNum,
        type: txType,
        category: txCategory,
        description: txDescription,
      });
      setTxSuccess("Transaction created successfully!");
      setTxAmount("");
      setTxCategory("");
      setTxDescription("");
    } catch (err: any) {
      setTxError(err.message || "Failed to create transaction.");
    }
  };

  const handleExportCSV = () => {
    if (!analytics || !analytics.timeSeries) return;

    // Filter rows that have non-zero activity (income or expense)
    const activeRows = analytics.timeSeries.filter(
      (row) => row.income !== 0 || row.expense !== 0
    );

    // Generate CSV content
    const headers = "Date,Income,Expense,Net";
    const csvRows = activeRows.map(
      (row) => `${row.date},${row.income},${row.expense},${row.net}`
    );
    const csvContent = [headers, ...csvRows].join("\n");

    // Create a Blob and download it
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

  if (!user) {
    return <div>Loading user...</div>;
  }

  const username = user.identities.username?.id || "User";

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto", fontFamily: "sans-serif" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", borderBottom: "1px solid #eee", paddingBottom: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Financial Analytics Dashboard</h1>
          <p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>Welcome, <strong>{username}</strong>!</p>
        </div>
        <button onClick={logout} style={{ padding: "0.5rem 1rem", backgroundColor: "#dc3545", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}>
          Logout
        </button>
      </header>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: "2rem" }}>
        {/* Left Sidebar: Controls & Add Transaction */}
        <div>
          {/* Filters Section */}
          <section style={{ backgroundColor: "#f8f9fa", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Filters</h3>
            
            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="start-date" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Start Date</label>
              <input
                type="date"
                id="start-date"
                data-testid="start-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="end-date" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>End Date</label>
              <input
                type="date"
                id="end-date"
                data-testid="end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label htmlFor="resolution" style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Resolution</label>
              <select
                id="resolution"
                data-testid="resolution"
                value={resolution}
                onChange={(e) => setResolution(e.target.value as "day" | "week" | "month")}
                style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value="day">day</option>
                <option value="week">week</option>
                <option value="month">month</option>
              </select>
            </div>
          </section>

          {/* Add Transaction Section */}
          <section style={{ backgroundColor: "#f8f9fa", padding: "1.5rem", borderRadius: "8px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Add Transaction</h3>
            <form onSubmit={handleCreateTransaction}>
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Date</label>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Amount</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Type</label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as "INCOME" | "EXPENSE")}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  <option value="INCOME">INCOME</option>
                  <option value="EXPENSE">EXPENSE</option>
                </select>
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Category</label>
                <input
                  type="text"
                  placeholder="e.g. Sales, Rent"
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  required
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold" }}>Description</label>
                <input
                  type="text"
                  placeholder="e.g. Project payment"
                  value={txDescription}
                  onChange={(e) => setTxDescription(e.target.value)}
                  style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
                  required
                />
              </div>

              {txError && <p style={{ color: "#dc3545", margin: "0.5rem 0" }}>{txError}</p>}
              {txSuccess && <p style={{ color: "#28a745", margin: "0.5rem 0" }}>{txSuccess}</p>}

              <button type="submit" style={{ width: "100%", padding: "0.75rem", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}>
                Add Transaction
              </button>
            </form>
          </section>
        </div>

        {/* Right Section: Analytics Dashboard */}
        <div>
          {isLoading ? (
            <div>Loading analytics...</div>
          ) : error ? (
            <div style={{ color: "#dc3545" }}>Error loading analytics: {error.message || "Unknown error"}</div>
          ) : analytics ? (
            <div>
              {/* Summary Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
                <div style={{ border: "1px solid #eee", padding: "1.5rem", borderRadius: "8px", backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", textAlign: "center" }}>
                  <h4 style={{ margin: 0, color: "#666", fontSize: "0.9rem", textTransform: "uppercase" }}>Total Income</h4>
                  <p data-testid="total-income" style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "0.5rem 0 0 0", color: "#28a745" }}>
                    {analytics.summary.totalIncome}
                  </p>
                </div>

                <div style={{ border: "1px solid #eee", padding: "1.5rem", borderRadius: "8px", backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", textAlign: "center" }}>
                  <h4 style={{ margin: 0, color: "#666", fontSize: "0.9rem", textTransform: "uppercase" }}>Total Expense</h4>
                  <p data-testid="total-expense" style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "0.5rem 0 0 0", color: "#dc3545" }}>
                    {analytics.summary.totalExpense}
                  </p>
                </div>

                <div style={{ border: "1px solid #eee", padding: "1.5rem", borderRadius: "8px", backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", textAlign: "center" }}>
                  <h4 style={{ margin: 0, color: "#666", fontSize: "0.9rem", textTransform: "uppercase" }}>Net Savings</h4>
                  <p data-testid="net-savings" style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "0.5rem 0 0 0", color: analytics.summary.netSavings >= 0 ? "#007bff" : "#dc3545" }}>
                    {analytics.summary.netSavings}
                  </p>
                </div>

                <div style={{ border: "1px solid #eee", padding: "1.5rem", borderRadius: "8px", backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", textAlign: "center" }}>
                  <h4 style={{ margin: 0, color: "#666", fontSize: "0.9rem", textTransform: "uppercase" }}>Savings Rate</h4>
                  <p data-testid="savings-rate" style={{ fontSize: "1.8rem", fontWeight: "bold", margin: "0.5rem 0 0 0", color: "#17a2b8" }}>
                    {analytics.summary.savingsRate.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Time Series Table & Export Button */}
              <div style={{ border: "1px solid #eee", padding: "1.5rem", borderRadius: "8px", backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", marginBottom: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ margin: 0 }}>Aggregated Time-Series</h3>
                  <button
                    id="export-csv"
                    data-testid="export-csv"
                    onClick={handleExportCSV}
                    style={{ padding: "0.5rem 1rem", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold", cursor: "pointer" }}
                  >
                    Export CSV
                  </button>
                </div>

                <table data-testid="analytics-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #eee" }}>
                      <th style={{ padding: "0.75rem" }}>Date</th>
                      <th style={{ padding: "0.75rem" }}>Income</th>
                      <th style={{ padding: "0.75rem" }}>Expense</th>
                      <th style={{ padding: "0.75rem" }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.timeSeries.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "1rem", textAlign: "center", color: "#666" }}>No data available for this range.</td>
                      </tr>
                    ) : (
                      analytics.timeSeries.map((row, index) => (
                        <tr key={index} data-testid="analytics-row" style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: "0.75rem" }}>{row.date}</td>
                          <td style={{ padding: "0.75rem", color: "#28a745" }}>{row.income}</td>
                          <td style={{ padding: "0.75rem", color: "#dc3545" }}>{row.expense}</td>
                          <td style={{ padding: "0.75rem", fontWeight: "bold", color: row.net >= 0 ? "#007bff" : "#dc3545" }}>{row.net}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Category Breakdown */}
              <div style={{ border: "1px solid #eee", padding: "1.5rem", borderRadius: "8px", backgroundColor: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
                <h3 style={{ marginTop: 0, marginBottom: "1rem" }}>Category Breakdown</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
                  <div>
                    <h4 style={{ color: "#28a745", borderBottom: "1px solid #eee", paddingBottom: "0.5rem" }}>Income Categories</h4>
                    <ul style={{ listStyle: "none", padding: 0 }}>
                      {analytics.categoryBreakdown.filter(c => c.type === "INCOME").length === 0 ? (
                        <li style={{ color: "#666" }}>No income categories.</li>
                      ) : (
                        analytics.categoryBreakdown
                          .filter(c => c.type === "INCOME")
                          .map((item, index) => (
                            <li key={index} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px dashed #eee" }}>
                              <span>{item.category}</span>
                              <strong style={{ color: "#28a745" }}>${item.amount.toFixed(2)}</strong>
                            </li>
                          ))
                      )}
                    </ul>
                  </div>

                  <div>
                    <h4 style={{ color: "#dc3545", borderBottom: "1px solid #eee", paddingBottom: "0.5rem" }}>Expense Categories</h4>
                    <ul style={{ listStyle: "none", padding: 0 }}>
                      {analytics.categoryBreakdown.filter(c => c.type === "EXPENSE").length === 0 ? (
                        <li style={{ color: "#666" }}>No expense categories.</li>
                      ) : (
                        analytics.categoryBreakdown
                          .filter(c => c.type === "EXPENSE")
                          .map((item, index) => (
                            <li key={index} style={{ display: "flex", justifyContent: "space-between", padding: "0.5rem 0", borderBottom: "1px dashed #eee" }}>
                              <span>{item.category}</span>
                              <strong style={{ color: "#dc3545" }}>${item.amount.toFixed(2)}</strong>
                            </li>
                          ))
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>No analytics data.</div>
          )}
        </div>
      </div>
    </div>
  );
}
