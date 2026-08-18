import React, { useState } from "react";
import { logout, useAuth } from "wasp/client/auth";
import { useQuery, getAnalytics, createTransaction } from "wasp/client/operations";
import "./Main.css";

export function MainPage() {
  const { data: user } = useAuth();

  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [resolution, setResolution] = useState<"day" | "week" | "month">("day");

  // Form state for creating a transaction
  const [newTxDate, setNewTxDate] = useState("2026-07-01");
  const [newTxAmount, setNewTxAmount] = useState("");
  const [newTxType, setNewTxType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [newTxCategory, setNewTxCategory] = useState("");
  const [newTxDescription, setNewTxDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const { data: analytics, isLoading, error } = useQuery(getAnalytics, {
    startDate,
    endDate,
    resolution,
  });

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!newTxDate || !newTxAmount || !newTxCategory || !newTxDescription) {
      setFormError("All fields are required");
      return;
    }

    const amountNum = parseFloat(newTxAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("Amount must be a positive number");
      return;
    }

    try {
      await createTransaction({
        date: newTxDate,
        amount: amountNum,
        type: newTxType,
        category: newTxCategory,
        description: newTxDescription,
      });
      setFormSuccess("Transaction created successfully!");
      setNewTxAmount("");
      setNewTxCategory("");
      setNewTxDescription("");
    } catch (err: any) {
      setFormError(err.message || "Failed to create transaction");
    }
  };

  const handleExportCSV = () => {
    if (!analytics || !analytics.timeSeries) return;

    // Filter rows that have non-zero activity (income or expense)
    const filteredRows = analytics.timeSeries.filter(
      (row: any) => row.income !== 0 || row.expense !== 0
    );

    // Build CSV content
    const headers = "Date,Income,Expense,Net\n";
    const body = filteredRows
      .map((row: any) => `${row.date},${row.income},${row.expense},${row.net}`)
      .join("\n");

    const csvContent = headers + body + (body ? "\n" : "");

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
    <div className="dashboard-container" style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "20px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0 }}>Financial Analytics Dashboard</h1>
          {user && <p style={{ margin: "5px 0 0", color: "#666" }}>Logged in as: <strong>{user.identities.username?.id || "user"}</strong></p>}
        </div>
        <button 
          onClick={logout} 
          style={{ padding: "8px 16px", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Logout
        </button>
      </header>

      {/* Interactive Controls */}
      <section style={{ backgroundColor: "#f9f9f9", padding: "20px", borderRadius: "8px", marginBottom: "20px", display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <label htmlFor="start-date" style={{ fontWeight: "bold", fontSize: "14px" }}>Start Date</label>
          <input 
            type="date" 
            id="start-date" 
            data-testid="start-date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <label htmlFor="end-date" style={{ fontWeight: "bold", fontSize: "14px" }}>End Date</label>
          <input 
            type="date" 
            id="end-date" 
            data-testid="end-date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
          <label htmlFor="resolution" style={{ fontWeight: "bold", fontSize: "14px" }}>Resolution</label>
          <select 
            id="resolution" 
            data-testid="resolution" 
            value={resolution} 
            onChange={(e) => setResolution(e.target.value as any)}
            style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "white" }}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        <button 
          id="export-csv" 
          data-testid="export-csv" 
          onClick={handleExportCSV}
          style={{ padding: "10px 20px", backgroundColor: "#007bff", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
        >
          Export CSV
        </button>
      </section>

      {isLoading && <p>Loading analytics data...</p>}
      {error && <p style={{ color: "red" }}>Error loading data: {error.message || "Unknown error"}</p>}

      {analytics && (
        <>
          {/* Summary Displays */}
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px", marginBottom: "30px" }}>
            <div style={{ backgroundColor: "#e3f2fd", padding: "20px", borderRadius: "8px", borderLeft: "5px solid #2196f3" }}>
              <h3 style={{ margin: "0 0 10px", color: "#0d47a1" }}>Total Income</h3>
              <div data-testid="total-income" style={{ fontSize: "24px", fontWeight: "bold", color: "#1565c0" }}>
                ${analytics.summary.totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ backgroundColor: "#ffebee", padding: "20px", borderRadius: "8px", borderLeft: "5px solid #f44336" }}>
              <h3 style={{ margin: "0 0 10px", color: "#b71c1c" }}>Total Expense</h3>
              <div data-testid="total-expense" style={{ fontSize: "24px", fontWeight: "bold", color: "#c62828" }}>
                ${analytics.summary.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ backgroundColor: "#e8f5e9", padding: "20px", borderRadius: "8px", borderLeft: "5px solid #4caf50" }}>
              <h3 style={{ margin: "0 0 10px", color: "#1b5e20" }}>Net Savings</h3>
              <div data-testid="net-savings" style={{ fontSize: "24px", fontWeight: "bold", color: "#2e7d32" }}>
                ${analytics.summary.netSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div style={{ backgroundColor: "#fff8e1", padding: "20px", borderRadius: "8px", borderLeft: "5px solid #ffc107" }}>
              <h3 style={{ margin: "0 0 10px", color: "#7f5f00" }}>Savings Rate</h3>
              <div data-testid="savings-rate" style={{ fontSize: "24px", fontWeight: "bold", color: "#f57f17" }}>
                {analytics.summary.savingsRate.toFixed(2)}%
              </div>
            </div>
          </section>

          {/* Main Content Layout */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "30px" }}>
            {/* Time-Series Table */}
            <section>
              <h2 style={{ marginBottom: "15px" }}>Time-Series Report ({resolution})</h2>
              <div style={{ overflowX: "auto" }}>
                <table data-testid="analytics-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f2f2f2", borderBottom: "2px solid #ddd" }}>
                      <th style={{ padding: "12px", border: "1px solid #ddd" }}>Date</th>
                      <th style={{ padding: "12px", border: "1px solid #ddd" }}>Income</th>
                      <th style={{ padding: "12px", border: "1px solid #ddd" }}>Expense</th>
                      <th style={{ padding: "12px", border: "1px solid #ddd" }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.timeSeries.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "20px", textAlign: "center", color: "#666" }}>No activity in this date range</td>
                      </tr>
                    ) : (
                      analytics.timeSeries.map((row: any) => (
                        <tr key={row.date} data-testid="analytics-row" style={{ borderBottom: "1px solid #ddd" }}>
                          <td style={{ padding: "12px", border: "1px solid #ddd" }}>{row.date}</td>
                          <td style={{ padding: "12px", border: "1px solid #ddd", color: "green", fontWeight: "bold" }}>
                            ${row.income.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "12px", border: "1px solid #ddd", color: "red", fontWeight: "bold" }}>
                            ${row.expense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td style={{ padding: "12px", border: "1px solid #ddd", fontWeight: "bold", color: row.net >= 0 ? "green" : "red" }}>
                            ${row.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Sidebar: Add Transaction & Category Breakdown */}
            <aside style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              {/* Category Breakdown */}
              <section style={{ border: "1px solid #eee", padding: "20px", borderRadius: "8px" }}>
                <h3 style={{ margin: "0 0 15px" }}>Category Breakdown</h3>
                {analytics.categoryBreakdown.length === 0 ? (
                  <p style={{ color: "#666", fontSize: "14px" }}>No categories to display</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {analytics.categoryBreakdown.map((item: any, idx: number) => (
                      <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", borderBottom: "1px dashed #eee", paddingBottom: "5px" }}>
                        <span>
                          <strong>{item.category}</strong> ({item.type})
                        </span>
                        <span style={{ color: item.type === "INCOME" ? "green" : "red", fontWeight: "bold" }}>
                          ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Add Transaction Form */}
              <section style={{ border: "1px solid #eee", padding: "20px", borderRadius: "8px" }}>
                <h3 style={{ margin: "0 0 15px" }}>Add Transaction</h3>
                <form onSubmit={handleCreateTransaction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "bold" }}>Date</label>
                    <input 
                      type="date" 
                      value={newTxDate} 
                      onChange={(e) => setNewTxDate(e.target.value)}
                      style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                      required
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "bold" }}>Amount</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      placeholder="0.00"
                      value={newTxAmount} 
                      onChange={(e) => setNewTxAmount(e.target.value)}
                      style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                      required
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "bold" }}>Type</label>
                    <select 
                      value={newTxType} 
                      onChange={(e) => setNewTxType(e.target.value as any)}
                      style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", backgroundColor: "white" }}
                    >
                      <option value="INCOME">Income</option>
                      <option value="EXPENSE">Expense</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "bold" }}>Category</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Food, Rent, Salary"
                      value={newTxCategory} 
                      onChange={(e) => setNewTxCategory(e.target.value)}
                      style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                      required
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12px", fontWeight: "bold" }}>Description</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Grocery shopping"
                      value={newTxDescription} 
                      onChange={(e) => setNewTxDescription(e.target.value)}
                      style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
                      required
                    />
                  </div>
                  {formError && <p style={{ color: "red", margin: 0, fontSize: "12px" }}>{formError}</p>}
                  {formSuccess && <p style={{ color: "green", margin: 0, fontSize: "12px" }}>{formSuccess}</p>}
                  <button 
                    type="submit" 
                    style={{ padding: "10px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
                  >
                    Save Transaction
                  </button>
                </form>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
