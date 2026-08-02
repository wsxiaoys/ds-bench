# Financial Analytics Dashboard with CSV Export

## Background
Financial analysts need to visualize transaction histories, track savings rates, and export aggregated summaries for reporting. You will build a Financial Analytics Dashboard using the Wasp framework (v0.24.0), which leverages React, Node.js, and Prisma.

## Requirements
- **Authentication**: Secure the dashboard so only logged-in users can access their own financial analytics.
- **Database Schema**: Store user transactions with dates, amounts, types (INCOME/EXPENSE), categories, and descriptions.
- **Complex Backend Aggregations**: Implement a custom Wasp Query that aggregates transaction data over a user-selected date range and resolution (day, week, or month) using Prisma raw queries on SQLite.
- **Interactive Frontend**: Build a responsive React dashboard displaying aggregate summaries (Total Income, Total Expense, Net Savings, Savings Rate), a time-series table, and interactive controls for filtering by date range and resolution.
- **Data Export**: Implement a client-side or server-side CSV export feature that downloads the current filtered time-series data as a CSV file.

## Implementation Hints
- **Project Path**: `/home/user/app`
- **Start Command**: `wasp start`
- **Port**: `3000`
- **Wasp Version**: Target Wasp `^0.24.0` using the TypeScript configuration spec (`main.wasp.ts`).
- **Database Schema (`schema.prisma`)**:
  - Define a `User` model with an autoincrementing integer ID.
  - Define a `Transaction` model with fields:
    - `id` (Int, primary key, autoincrement)
    - `date` (DateTime)
    - `amount` (Float)
    - `type` (String, must accept "INCOME" or "EXPENSE")
    - `category` (String)
    - `description` (String)
    - `user` (User, relation to `User` via `userId`)
    - `userId` (Int)
- **Wasp Configuration (`main.wasp.ts`)**:
  - Configure username and password authentication with `userEntity: "User"` and `onAuthFailedRedirectTo: "/login"`.
  - Export routes and pages for `/` (`MainPage`, requires auth), `/login` (`LoginPage`), and `/signup` (`SignupPage`).
  - Register a Query `getAnalytics` and an Action `createTransaction`, both associated with the `Transaction` entity.
  - Register a seed function named `seedData` under `db.seeds`.
- **Operations**:
  - **Query `getAnalytics`**:
    - Input: `{ startDate: string, endDate: string, resolution: "day" | "week" | "month" }` (where dates are ISO strings like `YYYY-MM-DD`).
    - Behavior: The query must use Prisma raw queries (e.g., `context.entities.Transaction.$queryRaw` or `$queryRawUnsafe`) to perform the time-series aggregation in SQLite. It must filter transactions by the current logged-in user, the date range (inclusive), and group them by the chosen resolution.
    - Output format:
      ```typescript
      {
        timeSeries: Array<{
          date: string; // "YYYY-MM-DD" for day, "YYYY-MM" for month, "YYYY-Www" for week (e.g., "2026-W31")
          income: number;
          expense: number;
          net: number;
        }>,
        categoryBreakdown: Array<{
          category: string;
          amount: number;
          type: "INCOME" | "EXPENSE";
        }>,
        summary: {
          totalIncome: number;
          totalExpense: number;
          netSavings: number;
          savingsRate: number; // calculated as (netSavings / totalIncome) * 100, or 0 if totalIncome is 0
        }
      }
      ```
  - **Action `createTransaction`**:
    - Input: `{ date: string, amount: number, type: "INCOME" | "EXPENSE", category: string, description: string }`
    - Behavior: Creates and returns a new transaction linked to the logged-in user.
- **Database Seeding**:
  - Implement a seed function `seedData` that creates a test user with username `testuser` and password `password123`, and seeds exactly the following 4 transactions for this user:
    1. Date: `2026-07-01`, Amount: `5000.0`, Type: `INCOME`, Category: `Sales`, Description: `Project payment`
    2. Date: `2026-07-15`, Amount: `1200.0`, Type: `EXPENSE`, Category: `Marketing`, Description: `Ad campaign`
    3. Date: `2026-07-20`, Amount: `800.0`, Type: `EXPENSE`, Category: `Software`, Description: `SaaS subscriptions`
    4. Date: `2026-07-25`, Amount: `2500.0`, Type: `INCOME`, Category: `Investment`, Description: `Dividend payout`
- **Frontend UI & Test IDs**:
  - **`LoginPage` and `SignupPage`**: Use Wasp's built-in `LoginForm` and `SignupForm` components from `wasp/client/auth`.
  - **`MainPage`**:
    - Add a logout button or link.
    - Start Date Input: `<input type="date" id="start-date" data-testid="start-date" />` (default: `2026-07-01`)
    - End Date Input: `<input type="date" id="end-date" data-testid="end-date" />` (default: `2026-07-31`)
    - Resolution Select: `<select id="resolution" data-testid="resolution">` with options `day`, `week`, `month` (default: `day`)
    - Summary displays:
      - Total Income: element with `data-testid="total-income"` (must display or contain `7500` or `7,500.00` with default filters)
      - Total Expense: element with `data-testid="total-expense"` (must display or contain `2000` or `2,000.00` with default filters)
      - Net Savings: element with `data-testid="net-savings"` (must display or contain `5500` or `5,500.00` with default filters)
      - Savings Rate: element with `data-testid="savings-rate"` (must display or contain `73.33` with default filters)
    - Analytics Table: `<table data-testid="analytics-table">` where each aggregated row has `data-testid="analytics-row"` displaying the date, income, expense, and net values.
    - Export Button: `<button id="export-csv" data-testid="export-csv">Export CSV</button>`
- **CSV Export Format**:
  - File name: `analytics_export.csv`
  - Headers: `Date,Income,Expense,Net`
  - Rows: Only include rows for dates that have non-zero activity (income or expense) within the selected date range, sorted chronologically. For the default range `2026-07-01` to `2026-07-31` with `day` resolution, the CSV must contain exactly the following lines:
    ```csv
    Date,Income,Expense,Net
    2026-07-01,5000,0,5000
    2026-07-15,0,1200,-1200
    2026-07-20,0,800,-800
    2026-07-25,2500,0,2500
    ```

