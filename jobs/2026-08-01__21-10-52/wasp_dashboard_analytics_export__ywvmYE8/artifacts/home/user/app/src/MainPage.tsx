import { useState } from "react";
import { logout } from "wasp/client/auth";
import { useQuery, getAnalytics, createTransaction } from "wasp/client/operations";
import "./Main.css";

export function MainPage() {
  const [startDate, setStartDate] = useState("2026-07-01");
  const [endDate, setEndDate] = useState("2026-07-31");
  const [resolution, setResolution] = useState<"day" | "week" | "month">("day");

  // Form state for creating a transaction
  const [newDate, setNewDate] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newType, setNewType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [newCategory, setNewCategory] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Fetch analytics data
  const { data: analytics, isLoading, error } = useQuery(getAnalytics, {
    startDate,
    endDate,
    resolution,
  });

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!newDate || !newAmount || !newCategory || !newDescription) {
      setFormError("Please fill out all fields.");
      return;
    }

    const amountNum = parseFloat(newAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setFormError("Please enter a valid amount greater than 0.");
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
      setFormSuccess("Transaction created successfully!");
      // Reset form
      setNewDate("");
      setNewAmount("");
      setNewCategory("");
      setNewDescription("");
    } catch (err: any) {
      setFormError(err.message || "Failed to create transaction.");
    }
  };

  const handleExportCSV = () => {
    if (!analytics || !analytics.timeSeries) return;

    // Filter rows with non-zero activity (income or expense)
    const activeRows = analytics.timeSeries.filter(
      (row: any) => row.income !== 0 || row.expense !== 0
    );

    // CSV Headers
    const headers = "Date,Income,Expense,Net";

    // CSV Rows
    const rows = activeRows.map(
      (row: any) => `${row.date},${row.income},${row.expense},${row.net}`
    );

    const csvContent = [headers, ...rows].join("\n");

    // Create file and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "analytics_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="dashboard-container" style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "15px", marginBottom: "20px" }}>
        <div style={{ flexGrow: 1 }}>
          <h1 style={{ margin: 0, fontSize: "24px", color: "#333" }}>Financial Analytics Dashboard</h1>
        </div>
        <button 
          onClick={logout} 
          style={{ padding: "8px 16px", backgroundColor: "#dc3545", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
        >
          Logout
        </button>
      </header>

      {/* Filter Controls */}
      <section className="filters-section" style={{ backgroundColor: "#f8f9fa", padding: "15px", borderRadius: "8px", marginBottom: "20px", display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <label htmlFor="start-date" style={{ marginRight: "8px", fontWeight: "bold" }}>Start Date:</label>
          <input 
            type="date" 
            id="start-date" 
            data-testid="start-date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)} 
            style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label htmlFor="end-date" style={{ marginRight: "8px", fontWeight: "bold" }}>End Date:</label>
          <input 
            type="date" 
            id="end-date" 
            data-testid="end-date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)} 
            style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label htmlFor="resolution" style={{ marginRight: "8px", fontWeight: "bold" }}>Resolution:</label>
          <select 
            id="resolution" 
            data-testid="resolution" 
            value={resolution} 
            onChange={(e) => setResolution(e.target.value as any)} 
            style={{ padding: "6px", borderRadius: "4px", border: "1px solid #ccc" }}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </div>

        <div style={{ marginLeft: "auto" }}>
          <button 
            id="export-csv" 
            data-testid="export-csv" 
            onClick={handleExportCSV}
            style={{ padding: "8px 16px", backgroundColor: "#28a745", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
          >
            Export CSV
          </button>
        </div>
      </section>

      {/* Loading / Error States */}
      {isLoading && <p>Loading analytics...</p>}
      {error && <p style={{ color: "red" }}>Error: {(error as any).message || "Failed to load data"}</p>}

      {analytics && (
        <>
          {/* Summary Cards */}
          <section className="summary-cards" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "30px" }}>
            <div style={{ padding: "20px", borderRadius: "8px", border: "1px solid #eee", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", backgroundColor: "#fff" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#666", fontSize: "14px" }}>Total Income</h3>
              <p data-testid="total-income" style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "#28a745" }}>
                ${analytics.summary.totalIncome.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div style={{ padding: "20px", borderRadius: "8px", border: "1px solid #eee", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", backgroundColor: "#fff" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#666", fontSize: "14px" }}>Total Expense</h3>
              <p data-testid="total-expense" style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "#dc3545" }}>
                ${analytics.summary.totalExpense.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div style={{ padding: "20px", borderRadius: "8px", border: "1px solid #eee", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", backgroundColor: "#fff" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#666", fontSize: "14px" }}>Net Savings</h3>
              <p data-testid="net-savings" style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: analytics.summary.netSavings >= 0 ? "#007bff" : "#dc3545" }}>
                ${analytics.summary.netSavings.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div style={{ padding: "20px", borderRadius: "8px", border: "1px solid #eee", boxShadow: "0 2px 4px rgba(0,0,0,0.05)", backgroundColor: "#fff" }}>
              <h3 style={{ margin: "0 0 10px 0", color: "#666", fontSize: "14px" }}>Savings Rate</h3>
              <p data-testid="savings-rate" style={{ margin: 0, fontSize: "24px", fontWeight: "bold", color: "#17a2b8" }}>
                {analytics.summary.savingsRate.toFixed(2)}%
              </p>
            </div>
          </section>

          {/* Main Dashboard Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px", flexWrap: "wrap" }}>
            {/* Left: Time-series Table */}
            <section style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #eee" }}>
              <h2 style={{ marginTop: 0, marginBottom: "15px", fontSize: "18px" }}>Time-Series Aggregation</h2>
              <div style={{ overflowX: "auto" }}>
                <table data-testid="analytics-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #eee" }}>
                      <th style={{ padding: "10px" }}>Date</th>
                      <th style={{ padding: "10px" }}>Income</th>
                      <th style={{ padding: "10px" }}>Expense</th>
                      <th style={{ padding: "10px" }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.timeSeries.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "15px", textAlign: "center", color: "#999" }}>No data in selected range</td>
                      </tr>
                    ) : (
                      analytics.timeSeries.map((row: any, idx: number) => (
                        <tr key={idx} data-testid="analytics-row" style={{ borderBottom: "1px solid #eee" }}>
                          <td style={{ padding: "10px" }}>{row.date}</td>
                          <td style={{ padding: "10px", color: "#28a745" }}>${row.income.toFixed(2)}</td>
                          <td style={{ padding: "10px", color: "#dc3545" }}>${row.expense.toFixed(2)}</td>
                          <td style={{ padding: "10px", fontWeight: "bold", color: row.net >= 0 ? "#28a745" : "#dc3545" }}>
                            ${row.net.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Right: Category Breakdown & Add Transaction Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: "25px" }}>
              {/* Category Breakdown */}
              <section style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #eee" }}>
                <h2 style={{ marginTop: 0, marginBottom: "15px", fontSize: "18px" }}>Category Breakdown</h2>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #eee" }}>
                        <th style={{ padding: "10px" }}>Category</th>
                        <th style={{ padding: "10px" }}>Type</th>
                        <th style={{ padding: "10px" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.categoryBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={3} style={{ padding: "15px", textAlign: "center", color: "#999" }}>No category data</td>
                        </tr>
                      ) : (
                        analytics.categoryBreakdown.map((cat: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                            <td style={{ padding: "10px" }}>{cat.category}</td>
                            <td style={{ padding: "10px" }}>
                              <span style={{ 
                                padding: "3px 8px", 
                                borderRadius: "12px", 
                                fontSize: "12px", 
                                fontWeight: "bold",
                                backgroundColor: cat.type === "INCOME" ? "#e2f0d9" : "#fce4d6",
                                color: cat.type === "INCOME" ? "#385723" : "#c65911"
                              }}>
                                {cat.type}
                              </span>
                            </td>
                            <td style={{ padding: "10px" }}>${cat.amount.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Add Transaction Form */}
              <section style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", border: "1px solid #eee" }}>
                <h2 style={{ marginTop: 0, marginBottom: "15px", fontSize: "18px" }}>Add Transaction</h2>
                <form onSubmit={handleCreateTransaction} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {formError && <p style={{ color: "red", margin: 0 }}>{formError}</p>}
                  {formSuccess && <p style={{ color: "green", margin: 0 }}>{formSuccess}</p>}

                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "14px" }}>Date</label>
                      <input 
                        type="date" 
                        value={newDate} 
                        onChange={(e) => setNewDate(e.target.value)} 
                        style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "14px" }}>Amount</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00"
                        value={newAmount} 
                        onChange={(e) => setNewAmount(e.target.value)} 
                        style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px" }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "14px" }}>Type</label>
                      <select 
                        value={newType} 
                        onChange={(e) => setNewType(e.target.value as any)} 
                        style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
                      >
                        <option value="INCOME">Income</option>
                        <option value="EXPENSE">Expense</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "14px" }}>Category</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Food, Salary"
                        value={newCategory} 
                        onChange={(e) => setNewCategory(e.target.value)} 
                        style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold", fontSize: "14px" }}>Description</label>
                    <input 
                      type="text" 
                      placeholder="Transaction details..."
                      value={newDescription} 
                      onChange={(e) => setNewDescription(e.target.value)} 
                      style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    style={{ padding: "10px", backgroundColor: "#007bff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold", marginTop: "5px" }}
                  >
                    Add Transaction
                  </button>
                </form>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
