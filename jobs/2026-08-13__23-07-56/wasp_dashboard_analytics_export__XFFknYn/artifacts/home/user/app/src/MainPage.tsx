import { useState } from "react";
import type { AuthUser } from "wasp/auth";
import { logout } from "wasp/client/auth";
import { useQuery, getAnalytics, createTransaction } from "wasp/client/operations";

export const MainPage = ({ user }: { user: AuthUser }) => {
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [resolution, setResolution] = useState<"day" | "week" | "month">("day");

  // Form state for creating a transaction
  const [newDate, setNewDate] = useState("2026-07-01");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [formError, setFormError] = useState("");

  const { data: analyticsData, isLoading, error } = useQuery(getAnalytics, {
    startDate,
    endDate,
    resolution,
  });

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!newDate || !newAmount || !newCategory || !newDescription) {
      setFormError("All fields are required.");
      return;
    }

    const amountNum = parseFloat(newAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("Amount must be a positive number.");
      return;
    }

    try {
      await createTransaction({
        date: newDate,
        amount: amountNum,
        type: newType,
        category: newCategory,
        description: newDescription,
      });

      // Reset form
      setNewAmount("");
      setNewCategory("");
      setNewDescription("");
    } catch (err: any) {
      setFormError(err.message || "Failed to create transaction.");
    }
  };

  const handleExportCSV = () => {
    if (!analyticsData || !analyticsData.timeSeries) return;

    // Filter timeSeries to only include rows with non-zero activity (income or expense > 0)
    const filteredRows = analyticsData.timeSeries.filter(
      (row: any) => row.income !== 0 || row.expense !== 0
    );

    // Generate CSV content
    const headers = "Date,Income,Expense,Net";
    const csvLines = filteredRows.map(
      (row: any) => `${row.date},${row.income},${row.expense},${row.net}`
    );
    const csvContent = [headers, ...csvLines].join("\n");

    // Create downloadable blob
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

  const summary = analyticsData?.summary || {
    totalIncome: 0,
    totalExpense: 0,
    netSavings: 0,
    savingsRate: 0,
  };

  const timeSeries = analyticsData?.timeSeries || [];
  const categoryBreakdown = analyticsData?.categoryBreakdown || [];

  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #ccc", paddingBottom: "1rem", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Financial Analytics Dashboard</h1>
          <p style={{ margin: "0.5rem 0 0 0", color: "#666" }}>Logged in as {user.getFirstProviderUserId()}</p>
        </div>
        <button 
          onClick={logout} 
          style={{ padding: "0.5rem 1rem", backgroundColor: "#f44336", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Logout
        </button>
      </header>

      {/* Controls */}
      <section style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", backgroundColor: "#f9f9f9", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label htmlFor="start-date" style={{ fontWeight: "bold" }}>Start Date</label>
          <input 
            type="date" 
            id="start-date" 
            data-testid="start-date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label htmlFor="end-date" style={{ fontWeight: "bold" }}>End Date</label>
          <input 
            type="date" 
            id="end-date" 
            data-testid="end-date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label htmlFor="resolution" style={{ fontWeight: "bold" }}>Resolution</label>
          <select 
            id="resolution" 
            data-testid="resolution" 
            value={resolution} 
            onChange={(e) => setResolution(e.target.value as any)}
            style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button 
            id="export-csv" 
            data-testid="export-csv" 
            onClick={handleExportCSV}
            style={{ padding: "0.6rem 1.2rem", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
          >
            Export CSV
          </button>
        </div>
      </section>

      {/* Summary Cards */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ padding: "1.5rem", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", backgroundColor: "#e8f5e9", borderLeft: "5px solid #2e7d32" }}>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#2e7d32", fontSize: "0.9rem", textTransform: "uppercase" }}>Total Income</h3>
          <p data-testid="total-income" style={{ margin: 0, fontSize: "1.8rem", fontWeight: "bold", color: "#1b5e20" }}>
            ${summary.totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div style={{ padding: "1.5rem", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", backgroundColor: "#ffebee", borderLeft: "5px solid #c62828" }}>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#c62828", fontSize: "0.9rem", textTransform: "uppercase" }}>Total Expense</h3>
          <p data-testid="total-expense" style={{ margin: 0, fontSize: "1.8rem", fontWeight: "bold", color: "#b71c1c" }}>
            ${summary.totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div style={{ padding: "1.5rem", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", backgroundColor: "#e3f2fd", borderLeft: "5px solid #1565c0" }}>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#1565c0", fontSize: "0.9rem", textTransform: "uppercase" }}>Net Savings</h3>
          <p data-testid="net-savings" style={{ margin: 0, fontSize: "1.8rem", fontWeight: "bold", color: "#0d47a1" }}>
            ${summary.netSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div style={{ padding: "1.5rem", borderRadius: "8px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", backgroundColor: "#fff8e1", borderLeft: "5px solid #ff8f00" }}>
          <h3 style={{ margin: "0 0 0.5rem 0", color: "#ff8f00", fontSize: "0.9rem", textTransform: "uppercase" }}>Savings Rate</h3>
          <p data-testid="savings-rate" style={{ margin: 0, fontSize: "1.8rem", fontWeight: "bold", color: "#e65100" }}>
            {summary.savingsRate.toFixed(2)}%
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "2rem", flexWrap: "wrap" }}>
        
        {/* Table & Loading/Error */}
        <section>
          <h2 style={{ marginTop: 0, marginBottom: "1rem" }}>Time-Series Report</h2>
          {isLoading && <p>Loading analytics data...</p>}
          {error && <p style={{ color: "red" }}>Error loading data: {error.message || "Unknown error"}</p>}
          
          {!isLoading && !error && (
            <div style={{ overflowX: "auto" }}>
              <table data-testid="analytics-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f2f2f2", borderBottom: "2px solid #ccc" }}>
                    <th style={{ padding: "10px", border: "1px solid #ddd" }}>Date</th>
                    <th style={{ padding: "10px", border: "1px solid #ddd" }}>Income</th>
                    <th style={{ padding: "10px", border: "1px solid #ddd" }}>Expense</th>
                    <th style={{ padding: "10px", border: "1px solid #ddd" }}>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {timeSeries.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ padding: "15px", textAlign: "center", color: "#999" }}>No transaction activity in this range</td>
                    </tr>
                  ) : (
                    timeSeries.map((row: any, idx: number) => (
                      <tr key={idx} data-testid="analytics-row" style={{ borderBottom: "1px solid #ddd" }}>
                        <td style={{ padding: "10px", border: "1px solid #ddd", fontWeight: "bold" }}>{row.date}</td>
                        <td style={{ padding: "10px", border: "1px solid #ddd", color: "#2e7d32" }}>
                          ${row.income.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "10px", border: "1px solid #ddd", color: "#c62828" }}>
                          ${row.expense.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ padding: "10px", border: "1px solid #ddd", fontWeight: "bold", color: row.net >= 0 ? "#1565c0" : "#c62828" }}>
                          ${row.net.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Category Breakdown */}
          <h2 style={{ marginTop: "2rem", marginBottom: "1rem" }}>Category Breakdown</h2>
          {!isLoading && !error && (
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {categoryBreakdown.length === 0 ? (
                <p style={{ color: "#999" }}>No category breakdown available</p>
              ) : (
                categoryBreakdown.map((item: any, idx: number) => (
                  <div key={idx} style={{ padding: "0.8rem 1.2rem", backgroundColor: item.type === "INCOME" ? "#e8f5e9" : "#ffebee", border: `1px solid ${item.type === "INCOME" ? "#a5d6a7" : "#ef9a9a"}`, borderRadius: "20px", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontWeight: "bold" }}>{item.category}:</span>
                    <span style={{ color: item.type === "INCOME" ? "#2e7d32" : "#c62828", fontWeight: "bold" }}>
                      {item.type === "INCOME" ? "+" : "-"}${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* Add Transaction Form */}
        <section style={{ backgroundColor: "#fafafa", padding: "1.5rem", borderRadius: "8px", border: "1px solid #eee", height: "fit-content" }}>
          <h2 style={{ marginTop: 0, marginBottom: "1rem" }}>Add Transaction</h2>
          {formError && <p style={{ color: "red", backgroundColor: "#ffebee", padding: "0.5rem", borderRadius: "4px" }}>{formError}</p>}
          
          <form onSubmit={handleCreateTransaction} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label htmlFor="tx-date" style={{ fontWeight: "bold", fontSize: "0.9rem" }}>Date</label>
              <input 
                type="date" 
                id="tx-date" 
                value={newDate} 
                onChange={(e) => setNewDate(e.target.value)} 
                required
                style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label htmlFor="tx-amount" style={{ fontWeight: "bold", fontSize: "0.9rem" }}>Amount ($)</label>
              <input 
                type="number" 
                id="tx-amount" 
                step="0.01" 
                min="0.01" 
                placeholder="e.g. 150.00" 
                value={newAmount} 
                onChange={(e) => setNewAmount(e.target.value)} 
                required
                style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label htmlFor="tx-type" style={{ fontWeight: "bold", fontSize: "0.9rem" }}>Type</label>
              <select 
                id="tx-type" 
                value={newType} 
                onChange={(e) => setNewType(e.target.value as any)}
                style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
              >
                <option value="INCOME">Income</option>
                <option value="EXPENSE">Expense</option>
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label htmlFor="tx-category" style={{ fontWeight: "bold", fontSize: "0.9rem" }}>Category</label>
              <input 
                type="text" 
                id="tx-category" 
                placeholder="e.g. Food, Salary, Rent" 
                value={newCategory} 
                onChange={(e) => setNewCategory(e.target.value)} 
                required
                style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <label htmlFor="tx-description" style={{ fontWeight: "bold", fontSize: "0.9rem" }}>Description</label>
              <input 
                type="text" 
                id="tx-description" 
                placeholder="e.g. Grocery shopping" 
                value={newDescription} 
                onChange={(e) => setNewDescription(e.target.value)} 
                required
                style={{ padding: "0.5rem", borderRadius: "4px", border: "1px solid #ccc" }}
              />
            </div>
            <button 
              type="submit" 
              style={{ padding: "0.75rem", backgroundColor: "#1565c0", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", marginTop: "0.5rem" }}
            >
              Add Transaction
            </button>
          </form>
        </section>

      </div>
    </div>
  );
};
