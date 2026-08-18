import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getSortedRowModel,
} from '@tanstack/react-table';

const DATA = [
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

export default function App() {
  const [groupBy, setGroupBy] = useState('none');
  const [grouping, setGrouping] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [sortGroups, setSortGroups] = useState('none');
  const [sorting, setSorting] = useState([]);

  const columns = useMemo(
    () => [
      {
        accessorKey: 'region',
        id: 'region',
        header: 'Region',
      },
      {
        accessorKey: 'category',
        id: 'category',
        header: 'Category',
      },
      {
        accessorKey: 'salesperson',
        id: 'salesperson',
        header: 'Salesperson',
      },
      {
        accessorKey: 'amount',
        id: 'amount',
        header: 'Amount',
        aggregationFn: 'sum',
      },
      {
        accessorKey: 'units',
        id: 'units',
        header: 'Units',
        aggregationFn: 'sum',
      },
      {
        accessorKey: 'unitPrice',
        id: 'unitPrice',
        header: 'Unit Price',
        accessorFn: (row) => row.amount / row.units,
        aggregationFn: (columnId, leafRows) => {
          if (!leafRows.length) return 0;
          const sum = leafRows.reduce((acc, row) => {
            const amount = row.original.amount;
            const units = row.original.units;
            return acc + amount / units;
          }, 0);
          return sum / leafRows.length;
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: DATA,
    columns,
    state: {
      grouping,
      expanded,
      sorting,
    },
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleGroupByChange = (e) => {
    const val = e.target.value;
    setGroupBy(val);
    if (val === 'none') {
      setGrouping([]);
    } else {
      setGrouping([val]);
    }
    setExpanded({});
  };

  const handleSortGroupsChange = (e) => {
    const val = e.target.value;
    setSortGroups(val);
    if (val === 'none') {
      setSorting([]);
    } else if (val === 'asc') {
      setSorting([{ id: 'amount', desc: false }]);
    } else if (val === 'desc') {
      setSorting([{ id: 'amount', desc: true }]);
    }
  };

  // Grand total is always the sum of amount over the whole dataset
  const grandTotalAmount = useMemo(() => {
    return DATA.reduce((sum, row) => sum + row.amount, 0);
  }, []);

  return (
    <div className="container">
      <h1>Analytical Sales Data Table</h1>

      <div className="controls">
        <div className="control-group">
          <label htmlFor="group-by">Group By</label>
          <select
            id="group-by"
            data-testid="group-by"
            value={groupBy}
            onChange={handleGroupByChange}
          >
            <option value="none">none</option>
            <option value="region">region</option>
            <option value="category">category</option>
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="sort-groups">Sort Groups (by Amount)</label>
          <select
            id="sort-groups"
            data-testid="sort-groups"
            value={sortGroups}
            onChange={handleSortGroupsChange}
          >
            <option value="none">none</option>
            <option value="asc">asc</option>
            <option value="desc">desc</option>
          </select>
        </div>
      </div>

      <div className="table-wrapper">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isFirstCol = index === 0;
                  return (
                    <th
                      key={header.id}
                      data-testid={isFirstCol ? 'pinned-col-header' : undefined}
                      className={isFirstCol ? 'pinned-col' : ''}
                      style={
                        isFirstCol
                          ? {
                              position: 'sticky',
                              left: '0px',
                              zIndex: 10,
                            }
                          : undefined
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : typeof header.column.columnDef.header === 'function'
                        ? header.column.columnDef.header(header.getContext())
                        : header.column.columnDef.header}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                // Group header row
                const sumAmount = row.leafRows.reduce(
                  (sum, r) => sum + r.original.amount,
                  0
                );
                const sumUnitPrice = row.leafRows.reduce(
                  (sum, r) => sum + r.original.amount / r.original.units,
                  0
                );
                const avgUnitPrice = sumUnitPrice / row.leafRows.length;
                const count = row.leafRows.length;

                return (
                  <tr
                    key={row.id}
                    data-testid="group-row"
                    data-group-value={row.groupingValue}
                    className="group-row"
                  >
                    {/* First column: Pinned, containing toggle, value and count */}
                    <td
                      className="pinned-col"
                      style={{
                        position: 'sticky',
                        left: '0px',
                        zIndex: 2,
                      }}
                    >
                      <button
                        data-testid="group-toggle"
                        className="toggle-btn"
                        onClick={row.getToggleExpandedHandler()}
                      >
                        {row.getIsExpanded() ? '▼' : '▶'}
                      </button>
                      <span>{row.groupingValue}</span>
                      <span className="badge" data-testid="group-count">
                        {count}
                      </span>
                    </td>
                    <td></td>
                    <td></td>
                    <td>
                      <span data-testid="group-sum-amount">{sumAmount}</span>
                    </td>
                    <td></td>
                    <td>
                      <span data-testid="group-avg-unit-price">
                        {avgUnitPrice}
                      </span>
                    </td>
                  </tr>
                );
              } else {
                // Leaf data row
                const isGroupedActive = groupBy !== 'none';
                const groupValue = isGroupedActive
                  ? row.original[groupBy]
                  : undefined;

                return (
                  <tr
                    key={row.id}
                    data-testid="data-row"
                    data-group-value={groupValue}
                  >
                    {/* First column: Region (pinned) */}
                    <td
                      className="pinned-col"
                      style={{
                        position: 'sticky',
                        left: '0px',
                        zIndex: 1,
                      }}
                    >
                      {row.original.region}
                    </td>
                    <td>{row.original.category}</td>
                    <td>{row.original.salesperson}</td>
                    <td data-testid="cell-amount">{row.original.amount}</td>
                    <td>{row.original.units}</td>
                    <td>{row.original.amount / row.original.units}</td>
                  </tr>
                );
              }
            })}
          </tbody>
          <tfoot>
            <tr>
              <td
                className="pinned-col"
                style={{
                  position: 'sticky',
                  left: '0px',
                  zIndex: 3,
                  fontWeight: 'bold',
                }}
              >
                Grand Total
              </td>
              <td></td>
              <td></td>
              <td data-testid="grand-total-amount" style={{ fontWeight: 'bold' }}>
                {grandTotalAmount}
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
