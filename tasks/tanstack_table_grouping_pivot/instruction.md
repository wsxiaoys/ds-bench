# Analytical Grouping Data Table with TanStack Table

## Background
Build a single-page web app that renders an analytical sales data table using **TanStack Table v8** (the headless `@tanstack/react-table` React adapter). The table must support grouping by a user-selected column, expandable/collapsible group rows, per-group aggregations, a grand-total footer, a horizontally-pinned column, and sorting of the group rows by an aggregate value. Everything runs locally in the browser — no external API, database, or network access.

## Requirements
- Render the fixed in-memory dataset of 12 sales rows given below (render exactly these rows and values).
- Data columns: `region`, `category`, `salesperson`, `amount`, `units`. Treat each row's unit price as `amount / units`.
- Let the user choose how the rows are grouped: no grouping, grouped by `region`, or grouped by `category`.
- When grouping is active, render one **group header row** per distinct value of the grouped column, each showing these aggregates computed over the rows in that group:
  - the **sum** of `amount`,
  - the **average unit price**, defined as the arithmetic mean of the per-row unit prices (`amount / units`) of the rows in that group,
  - the **count** of rows in the group.
- Group header rows must be collapsible/expandable. Whenever grouping is applied or the grouping column changes, every group starts **collapsed** (its child data rows hidden). Expanding a group reveals its child data rows; collapsing hides them again.
- Changing the grouping column at runtime must recompute the group rows and every aggregate accordingly.
- A **grand-total footer** row shows the sum of `amount` across the entire dataset. It must reflect the whole dataset regardless of the current grouping/expansion state.
- The leftmost label column must be **pinned to the left** and stay visually fixed when the table is scrolled horizontally.
- The user must be able to **sort the group header rows by their aggregated sum of `amount`**, ascending or descending; toggling this reorders the group header rows accordingly.

## Dataset (render exactly these 12 rows)
| region | category | salesperson | amount | units |
| ------ | -------- | ----------- | ------ | ----- |
| North  | Widgets  | Alice       | 1200   | 40    |
| North  | Gadgets  | Alice       | 800    | 20    |
| North  | Widgets  | Bob         | 600    | 15    |
| South  | Widgets  | Carol       | 1500   | 50    |
| South  | Gadgets  | Carol       | 400    | 10    |
| South  | Gadgets  | Dave        | 900    | 30    |
| East   | Widgets  | Erin        | 300    | 10    |
| East   | Gadgets  | Erin        | 1100   | 25    |
| North  | Gadgets  | Bob         | 700    | 35    |
| South  | Widgets  | Dave        | 700    | 28    |
| East   | Widgets  | Frank       | 2000   | 80    |
| East   | Gadgets  | Frank       | 600    | 15    |

## Implementation Hints
- Project path: /home/user/tanstack-grouping
- Use TanStack Table v8 headless: `@tanstack/react-table` version 8.21.3 with React.
- Start command: `npm run dev`. The app must be served over HTTP and listen on **port 5319**, reachable at `http://localhost:5319/`. Bind so that `http://localhost:5319/` responds from the same machine.
- The app is a client-rendered SPA; all grouping, expansion, sorting, and pinning state is managed in the browser.
- Aggregate numbers must be rendered as plain numbers with no currency symbol and no thousands separators (a single optional decimal point is allowed, e.g. `3300` or `32.5`).
- DOM contract — the verifier drives a real headless browser and depends on these exact hooks:
  - Grouping control: a `<select data-testid="group-by">` whose option `value`s are exactly `none`, `region`, `category`. The default selected value is `none`.
  - Group-sort control: a `<select data-testid="sort-groups">` whose option `value`s are exactly `none`, `asc`, `desc` (default `none`). `asc`/`desc` sort the group header rows by their aggregated sum of `amount`.
  - Group header row: an element with `data-testid="group-row"` and an attribute `data-group-value` set to the group's value (e.g. `North`, `Widgets`). Group header rows must appear in the DOM in their displayed order. Inside each group header row:
    - `data-testid="group-sum-amount"` — the group's sum of `amount`,
    - `data-testid="group-avg-unit-price"` — the group's average unit price,
    - `data-testid="group-count"` — the group's row count,
    - `data-testid="group-toggle"` — a control that expands/collapses that group when clicked.
  - Leaf data row: an element with `data-testid="data-row"` and `data-group-value` set to the value of the currently-grouped column for that row. Within each leaf data row, the `amount` value must be in a cell with `data-testid="cell-amount"` (rendered as a plain number, no thousands separators). When grouping is `none`, all 12 data rows are visible. When grouping is active, data rows of a collapsed group must be hidden (not visible); expanding the group makes them visible.
  - Grand-total footer: an element with `data-testid="grand-total-amount"` containing the sum of `amount` over the whole dataset.
  - Pinned column: the leftmost label column's header cell must have `data-testid="pinned-col-header"` and be rendered with computed CSS `position: sticky` and `left: 0px`.

