import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import './App.css';

// Fixed in-memory dataset of 12 sales rows
const dataset = [
  { region: 'North', category: 'Widgets', salesperson: 'Alice', amount: 1200, units: 40 },
  { region: 'North', category: 'Gadgets', salesperson: 'Alice', amount: 800, units: 20 },
  { region: 'North', category: 'Widgets', salesperson: 'Bob', amount: 600, units: 15 },
  { region: 'South', category: 'Widgets', salesperson: 'Carol', amount: 1500, units: 50 },
  { region: 'South', category: 'Gadgets', salesperson: 'Carol', amount: 400, units: 10 },
  { region: 'South', category: 'Gadgets', salesperson: 'Dave', amount: 900, units: 30 },
  { region: 'East', category: 'Widgets', salesperson: 'Erin', amount: 300, units: 10 },
  { region: 'East', category: 'Gadgets', salesperson: 'Erin', amount: 1100, units: 25 },
  { region: 'North', category: 'Gadgets', salesperson: 'Bob', amount: 700, units: 35 },
  { region: 'South', category: 'Widgets', salesperson: 'Dave', amount: 700, units: 28 },
  { region: 'East', category: 'Widgets', salesperson: 'Frank', amount: 2000, units: 80 },
  { region: 'East', category: 'Gadgets', salesperson: 'Frank', amount: 600, units: 15 },
];

function App() {
  // State for Grouping: 'none', 'region', or 'category'
  const [groupBy, setGroupBy] = useState('none');
  // State for Group Sorting: 'none', 'asc', or 'desc'
  const [sortGroups, setSortGroups] = useState('none');
  // State for expanded groups in TanStack Table
  const [expanded, setExpanded] = useState({});

  // Define columns
  const columns = useMemo(() => [
    {
      accessorKey: 'region',
      header: 'Region',
    },
    {
      accessorKey: 'category',
      header: 'Category',
    },
    {
      accessorKey: 'salesperson',
      header: 'Salesperson',
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      aggregationFn: 'sum',
      cell: info => info.getValue(),
    },
    {
      accessorKey: 'units',
      header: 'Units',
      aggregationFn: 'sum',
      cell: info => info.getValue(),
    },
    {
      id: 'unitPrice',
      header: 'Unit Price',
      accessorFn: row => row.amount / row.units,
      cell: info => {
        const val = info.getValue();
        return typeof val === 'number' ? Number(val.toFixed(4)) : val;
      },
    }
  ], []);

  // Sync sorting state with sortGroups selection
  const sorting = useMemo(() => {
    if (sortGroups === 'none') {
      return [];
    }
    return [{ id: 'amount', desc: sortGroups === 'desc' }];
  }, [sortGroups]);

  // Handle grouping selection change
  const handleGroupByChange = (e) => {
    const value = e.target.value;
    setGroupBy(value);
    setExpanded({}); // Reset expanded state so every group starts collapsed
  };

  // Handle group sort change
  const handleSortGroupsChange = (e) => {
    setSortGroups(e.target.value);
  };

  // Instantiate TanStack Table
  const table = useReactTable({
    data: dataset,
    columns,
    state: {
      grouping: groupBy === 'none' ? [] : [groupBy],
      expanded,
      sorting,
    },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // Keep grouped columns visible in their original position
    groupedColumnMode: false,
  });

  // Calculate Grand Total of Amount across the entire dataset
  const grandTotalAmount = useMemo(() => {
    return dataset.reduce((sum, row) => sum + row.amount, 0);
  }, []);

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Analytical Sales Dashboard</h1>
        <p className="subtitle">
          Interactive sales data table with TanStack Table v8
        </p>
      </header>

      <div className="controls-bar">
        <div className="control-group">
          <label htmlFor="group-by-select">Group By</label>
          <select
            id="group-by-select"
            data-testid="group-by"
            value={groupBy}
            onChange={handleGroupByChange}
            className="styled-select"
          >
            <option value="none">none</option>
            <option value="region">region</option>
            <option value="category">category</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="sort-groups-select">Sort Groups (by Amount)</label>
          <select
            id="sort-groups-select"
            data-testid="sort-groups"
            value={sortGroups}
            onChange={handleSortGroupsChange}
            className="styled-select"
          >
            <option value="none">none</option>
            <option value="asc">asc</option>
            <option value="desc">desc</option>
          </select>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="analytical-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isLeftmost = index === 0;
                  return (
                    <th
                      key={header.id}
                      data-testid={isLeftmost ? "pinned-col-header" : undefined}
                      className={isLeftmost ? "pinned-column-header" : ""}
                      style={
                        isLeftmost
                          ? {
                              position: 'sticky',
                              left: 0,
                              zIndex: 10,
                            }
                          : {}
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => {
              if (row.getIsGrouped()) {
                // Compute aggregates over the rows in this group
                const leafRows = row.getLeafRows();
                const count = leafRows.length;
                const sumAmount = leafRows.reduce((sum, r) => sum + r.original.amount, 0);
                
                // Arithmetic mean of the per-row unit prices
                const avgUnitPrice = leafRows.reduce(
                  (sum, r) => sum + (r.original.amount / r.original.units),
                  0
                ) / count;

                return (
                  <tr
                    key={row.id}
                    data-testid="group-row"
                    data-group-value={row.groupingValue}
                    className="group-row-header"
                  >
                    {/* Leftmost label column: pinned to the left */}
                    <td
                      className="pinned-column-cell group-toggle-cell"
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 5,
                      }}
                    >
                      <button
                        type="button"
                        data-testid="group-toggle"
                        onClick={row.getToggleExpandedHandler()}
                        className="toggle-button"
                        aria-label={`Toggle group ${row.groupingValue}`}
                      >
                        {row.getIsExpanded() ? '▼' : '▶'}
                      </button>
                      <span className="group-value-text">{row.groupingValue}</span>
                      <span data-testid="group-count" className="group-count-badge">
                        {count}
                      </span>
                    </td>
                    {/* Other cells are empty, but aggregates are aligned with respective columns */}
                    <td></td>
                    <td></td>
                    <td className="numeric-cell">
                      <span data-testid="group-sum-amount" className="aggregate-value">
                        {sumAmount}
                      </span>
                    </td>
                    <td></td>
                    <td className="numeric-cell">
                      <span data-testid="group-avg-unit-price" className="aggregate-value">
                        {Number(avgUnitPrice.toFixed(4))}
                      </span>
                    </td>
                  </tr>
                );
              }

              // Leaf data row
              const currentGroupedColumn = groupBy;
              const dataGroupValue = currentGroupedColumn !== 'none' ? row.original[currentGroupedColumn] : undefined;

              return (
                <tr
                  key={row.id}
                  data-testid="data-row"
                  data-group-value={dataGroupValue}
                  className="data-row"
                >
                  {row.getVisibleCells().map((cell, index) => {
                    const isLeftmost = index === 0;
                    const isAmount = cell.column.id === 'amount';
                    return (
                      <td
                        key={cell.id}
                        data-testid={isAmount ? "cell-amount" : undefined}
                        className={`${isLeftmost ? "pinned-column-cell" : ""} ${
                          cell.column.id === 'amount' || cell.column.id === 'units' || cell.column.id === 'unitPrice'
                            ? "numeric-cell"
                            : ""
                        }`}
                        style={
                          isLeftmost
                            ? {
                                position: 'sticky',
                                left: 0,
                                zIndex: 5,
                              }
                            : {}
                        }
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="grand-total-row">
              <td
                className="pinned-column-cell"
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 5,
                }}
              >
                <strong>Grand Total</strong>
              </td>
              <td></td>
              <td></td>
              <td className="numeric-cell">
                <strong data-testid="grand-total-amount">
                  {grandTotalAmount}
                </strong>
              </td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default App;
