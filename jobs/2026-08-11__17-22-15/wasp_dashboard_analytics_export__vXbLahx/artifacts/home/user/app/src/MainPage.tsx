import React, { useState } from "react";
import { useQuery, getAnalytics, createTransaction } from "wasp/client/operations";
import { useAuth, logout } from "wasp/client/auth";

export function MainPage() {
  const { data: user } = useAuth();
  
  // Date range and resolution filters
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [resolution, setResolution] = useState<"day" | "week" | "month">("day");

  // Fetch analytics data
  const { data: analyticsData, isLoading, error } = useQuery(getAnalytics, {
    startDate,
    endDate,
    resolution,
  });

  // New transaction form state
  const [newTxDate, setNewTxDate] = useState("2026-07-01");
  const [newTxAmount, setNewTxAmount] = useState("");
  const [newTxType, setNewTxType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [newTxCategory, setNewTxCategory] = useState("");
  const [newTxDescription, setNewTxDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!newTxDate || !newTxAmount || !newTxCategory || !newTxDescription) {
      setFormError("Please fill out all fields.");
      return;
    }

    const amountNum = parseFloat(newTxAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("Amount must be a positive number.");
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
      setFormError(err.message || "Failed to create transaction.");
    }
  };

  const handleExportCSV = () => {
    if (!analyticsData || !analyticsData.timeSeries) return;

    // Headers
    const headers = ["Date", "Income", "Expense", "Net"];
    
    // Filter rows with non-zero activity (income or expense)
    const rows = analyticsData.timeSeries
      .filter((row: any) => row.income !== 0 || row.expense !== 0)
      .map((row: any) => [row.date, row.income, row.expense, row.net]);

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) => row.join(","))
    ].join("\n");

    // Create blob and trigger download
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

  const totalIncome = analyticsData?.summary?.totalIncome ?? 0;
  const totalExpense = analyticsData?.summary?.totalExpense ?? 0;
  const netSavings = analyticsData?.summary?.netSavings ?? 0;
  const savingsRate = analyticsData?.summary?.savingsRate ?? 0;
  const timeSeries = analyticsData?.timeSeries ?? [];
  const categoryBreakdown = analyticsData?.categoryBreakdown ?? [];

  const username = user?.identities?.username?.id || "User";

  return (
    <div style={{ fontFamily: "Segoe UI, sans-serif", backgroundColor: "#f4f6f9", minHeight: "100vh", padding: "20px" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#ffffff", padding: "15px 30px", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", color: "#2c3e50" }}>Financial Analytics Dashboard</h1>
          <p style={{ margin: "5px 0 0 0", fontSize: "14px", color: "#7f8c8d" }}>Welcome back, <strong>{username}</strong></p>
        </div>
        <button 
          onClick={logout}
          style={{ backgroundColor: "#e74c3c", color: "#ffffff", border: "none", padding: "10px 20px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", transition: "background-color 0.2s" }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#c0392b")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#e74c3c")}
        >
          Logout
        </button>
      </header>

      {/* Main Content */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
        
        {/* Filters and Controls */}
        <section style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: "1 1 200px" }}>
            <label htmlFor="start-date" style={{ fontWeight: "bold", fontSize: "14px", color: "#34495e" }}>Start Date</label>
            <input 
              type="date" 
              id="start-date" 
              data-testid="start-date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              style={{ padding: "10px", borderRadius: "5px", border: "1px solid #ccc", fontSize: "14px" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: "1 1 200px" }}>
            <label htmlFor="end-date" style={{ fontWeight: "bold", fontSize: "14px", color: "#34495e" }}>End Date</label>
            <input 
              type="date" 
              id="end-date" 
              data-testid="end-date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              style={{ padding: "10px", borderRadius: "5px", border: "1px solid #ccc", fontSize: "14px" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: "1 1 150px" }}>
            <label htmlFor="resolution" style={{ fontWeight: "bold", fontSize: "14px", color: "#34495e" }}>Resolution</label>
            <select 
              id="resolution" 
              data-testid="resolution" 
              value={resolution} 
              onChange={(e) => setResolution(e.target.value as any)}
              style={{ padding: "10px", borderRadius: "5px", border: "1px solid #ccc", fontSize: "14px", backgroundColor: "#ffffff" }}
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
            style={{ backgroundColor: "#27ae60", color: "#ffffff", border: "none", padding: "11px 25px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", fontSize: "14px", transition: "background-color 0.2s" }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#219653")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#27ae60")}
          >
            Export CSV
          </button>
        </section>

        {/* Loading and Error States */}
        {isLoading && <div style={{ textAlign: "center", padding: "10px", color: "#7f8c8d", fontWeight: "bold" }}>Loading analytics data...</div>}
        {error && <div style={{ textAlign: "center", padding: "10px", color: "#e74c3c", fontWeight: "bold" }}>Error fetching data: {error.message}</div>}

        {/* Summary Cards */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
          
          <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", borderLeft: "5px solid #2ecc71" }}>
            <h3 style={{ margin: 0, fontSize: "14px", color: "#7f8c8d", textTransform: "uppercase" }}>Total Income</h3>
            <p data-testid="total-income" style={{ margin: "10px 0 0 0", fontSize: "28px", fontWeight: "bold", color: "#2ecc71" }}>
              ${totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", borderLeft: "5px solid #e74c3c" }}>
            <h3 style={{ margin: 0, fontSize: "14px", color: "#7f8c8d", textTransform: "uppercase" }}>Total Expense</h3>
            <p data-testid="total-expense" style={{ margin: "10px 0 0 0", fontSize: "28px", fontWeight: "bold", color: "#e74c3c" }}>
              ${totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", borderLeft: "5px solid #3498db" }}>
            <h3 style={{ margin: 0, fontSize: "14px", color: "#7f8c8d", textTransform: "uppercase" }}>Net Savings</h3>
            <p data-testid="net-savings" style={{ margin: "10px 0 0 0", fontSize: "28px", fontWeight: "bold", color: "#3498db" }}>
              ${netSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", borderLeft: "5px solid #f1c40f" }}>
            <h3 style={{ margin: 0, fontSize: "14px", color: "#7f8c8d", textTransform: "uppercase" }}>Savings Rate</h3>
            <p data-testid="savings-rate" style={{ margin: "10px 0 0 0", fontSize: "28px", fontWeight: "bold", color: "#f1c40f" }}>
              {savingsRate.toFixed(2)}%
            </p>
          </div>

        </section>

        {/* Grid for Table & Form */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "20px" }}>
          
          {/* Time Series Table */}
          <section style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
            <h2 style={{ margin: "0 0 15px 0", fontSize: "18px", color: "#2c3e50" }}>Time-Series Activity</h2>
            <div style={{ overflowX: "auto" }}>
              <table data-testid="analytics-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #ecf0f1" }}>
                    <th style={{ padding: "10px", color: "#7f8c8d", fontSize: "14px" }}>Date</th>
                    <th style={{ padding: "10px", color: "#7f8c8d", fontSize: "14px" }}>Income</th>
                    <th style={{ padding: "10px", color: "#7f8c8d", fontSize: "14px" }}>Expense</th>
                    <th style={{ padding: "10px", color: "#7f8c8d", fontSize: "14px" }}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {timeSeries.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: "20px", textAlign: "center", color: "#bdc3c7" }}>No transactions found for this period.</td>
                    </tr>
                  ) : (
                    timeSeries.map((row: any) => (
                      <tr key={row.date} data-testid="analytics-row" style={{ borderBottom: "1px solid #f1f2f6" }}>
                        <td style={{ padding: "10px", fontSize: "14px", fontWeight: "bold", color: "#2c3e50" }}>{row.date}</td>
                        <td style={{ padding: "10px", fontSize: "14px", color: "#2ecc71" }}>${row.income.toFixed(2)}</td>
                        <td style={{ padding: "10px", fontSize: "14px", color: "#e74c3c" }}>${row.expense.toFixed(2)}</td>
                        <td style={{ padding: "10px", fontSize: "14px", fontWeight: "bold", color: row.net >= 0 ? "#2ecc71" : "#e74c3c" }}>
                          ${row.net.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* Add Transaction Form */}
          <section style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
            <h2 style={{ margin: "0 0 15px 0", fontSize: "18px", color: "#2c3e50" }}>Add New Transaction</h2>
            <form onSubmit={handleCreateTransaction} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#7f8c8d" }}>Date</label>
                  <input 
                    type="date" 
                    value={newTxDate} 
                    onChange={(e) => setNewTxDate(e.target.value)}
                    style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc", fontSize: "14px" }}
                    required
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#7f8c8d" }}>Amount ($)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={newTxAmount} 
                    onChange={(e) => setNewTxAmount(e.target.value)}
                    style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc", fontSize: "14px" }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#7f8c8d" }}>Type</label>
                  <select 
                    value={newTxType} 
                    onChange={(e) => setNewTxType(e.target.value as any)}
                    style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc", fontSize: "14px", backgroundColor: "#ffffff" }}
                  >
                    <option value="INCOME">Income</option>
                    <option value="EXPENSE">Expense</option>
                  </select>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "bold", color: "#7f8c8d" }}>Category</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Food, Rent" 
                    value={newTxCategory} 
                    onChange={(e) => setNewTxCategory(e.target.value)}
                    style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc", fontSize: "14px" }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                <label style={{ fontSize: "12px", fontWeight: "bold", color: "#7f8c8d" }}>Description</label>
                <input 
                  type="text" 
                  placeholder="e.g., Weekly groceries" 
                  value={newTxDescription} 
                  onChange={(e) => setNewTxDescription(e.target.value)}
                  style={{ padding: "8px", borderRadius: "5px", border: "1px solid #ccc", fontSize: "14px" }}
                  required
                />
              </div>

              {formError && <div style={{ color: "#e74c3c", fontSize: "14px", fontWeight: "bold" }}>{formError}</div>}
              {formSuccess && <div style={{ color: "#2ecc71", fontSize: "14px", fontWeight: "bold" }}>{formSuccess}</div>}

              <button 
                type="submit"
                style={{ backgroundColor: "#3498db", color: "#ffffff", border: "none", padding: "10px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold", fontSize: "14px", marginTop: "5px", transition: "background-color 0.2s" }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#2980b9")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#3498db")}
              >
                Add Transaction
              </button>
            </form>
          </section>

        </div>

        {/* Category Breakdown Breakdown */}
        <section style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 4px rgba(0,0,0,0.05)" }}>
          <h2 style={{ margin: "0 0 15px 0", fontSize: "18px", color: "#2c3e50" }}>Category Breakdown</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
            {categoryBreakdown.length === 0 ? (
              <div style={{ color: "#bdc3c7", fontSize: "14px" }}>No category breakdown available.</div>
            ) : (
              categoryBreakdown.map((cat: any, idx: number) => (
                <div key={idx} style={{ backgroundColor: cat.type === "INCOME" ? "#e8f8f5" : "#fdedec", border: `1px solid ${cat.type === "INCOME" ? "#a3e4d7" : "#f9d5d3"}`, padding: "10px 15px", borderRadius: "20px", display: "flex", gap: "10px", alignItems: "center" }}>
                  <span style={{ fontWeight: "bold", fontSize: "14px", color: "#2c3e50" }}>{cat.category}</span>
                  <span style={{ fontSize: "12px", color: cat.type === "INCOME" ? "#16a085" : "#c0392b", fontWeight: "bold" }}>
                    {cat.type}: ${cat.amount.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
