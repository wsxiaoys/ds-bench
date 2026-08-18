import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  flexRender,
  ColumnDef,
  ExpandedState,
} from '@tanstack/react-table';

interface SalesRow {
  region: string;
  category: string;
  salesperson: string;
  amount: number;
  units: number;
}

const dataset: SalesRow[] = [
  { region: "North", category: "Widgets", salesperson: "Alice", amount: 1200, units: 40 },
  { region: "North", category: "Gadgets", salesperson: "Alice", amount: 800, units: 20 },
  { region: "North", category: "Widgets", salesperson: "Bob", amount: 600, units: 15 },
  { region: "South", category: "Widgets", salesperson: "Carol", amount: 1500, units: 50 },
  { region: "South", category: "Gadgets", salesperson: "Carol", amount: 400, units: 10 },
  { region: "South", category: "Gadgets", salesperson: "Dave", amount: 900, units: 30 },
  { region: "East", category: "Widgets", salesperson: "Erin", amount: 300, units: 10 },
  { region: "East", category: "Gadgets", salesperson: "Erin", amount: 1100, units: 25 },
  { region: "North", category: "Gadgets", salesperson: "Bob", amount: 700, units: 35 },
  { region: "South", category: "Widgets", salesperson: "Dave", amount: 700, units: 28 },
  { region: "East", category: "Widgets", salesperson: "Frank", amount: 2000, units: 80 },
  { region: "East", category: "Gadgets", salesperson: "Frank", amount: 600, units: 15 }
];

export default function App() {
  const [groupBy, setGroupBy] = useState<'none' | 'region' | 'category'>('none');
  const [sortGroups, setSortGroups] = useState<'none' | 'asc' | 'desc'>('none');
  const [expanded, setExpanded] = useState<ExpandedState>({});

  // Reset expanded state when groupBy changes so all groups start collapsed
  const handleGroupByChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as 'none' | 'region' | 'category';
    setGroupBy(value);
    setExpanded({});
  };

  const handleSortGroupsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as 'none' | 'asc' | 'desc';
    setSortGroups(value);
  };

  // Dynamically generate columns. The leftmost column is the grouped column (or region if none)
  const columns = useMemo<ColumnDef<SalesRow, any>[]>(() => {
    const baseColumns: ColumnDef<SalesRow, any>[] = [
      {
        id: 'region',
        accessorKey: 'region',
        header: 'Region',
      },
      {
        id: 'category',
        accessorKey: 'category',
        header: 'Category',
      },
      {
        id: 'salesperson',
        accessorKey: 'salesperson',
        header: 'Salesperson',
      },
      {
        id: 'amount',
        accessorKey: 'amount',
        header: 'Amount',
        aggregationFn: 'sum',
      },
      {
        id: 'units',
        accessorKey: 'units',
        header: 'Units',
      },
      {
        id: 'unitPrice',
        header: 'Unit Price',
        accessorFn: (row: SalesRow) => row.amount / row.units,
        cell: (info) => info.getValue(),
      },
    ];

    if (groupBy === 'category') {
      // Move category to the front
      const categoryCol = baseColumns.find(col => col.id === 'category')!;
      const otherCols = baseColumns.filter(col => col.id !== 'category');
      return [categoryCol, ...otherCols];
    } else {
      // Default / region: region is already at the front
      return baseColumns;
    }
  }, [groupBy]);

  const groupingState = useMemo(() => {
    return groupBy === 'none' ? [] : [groupBy];
  }, [groupBy]);

  const sortingState = useMemo(() => {
    return sortGroups === 'none' ? [] : [{ id: 'amount', desc: sortGroups === 'desc' }];
  }, [sortGroups]);

  const table = useReactTable({
    data: dataset,
    columns,
    state: {
      grouping: groupingState,
      expanded,
      sorting: sortingState,
    },
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const grandTotalAmount = useMemo(() => {
    return dataset.reduce((sum, row) => sum + row.amount, 0);
  }, []);

  return (
    <div className="container">
      <h1 style={{ marginBottom: '24px' }}>Analytical Sales Data Table</h1>

      <div className="controls">
        <div className="control-group">
          <label htmlFor="group-by-select">Group By</label>
          <select
            id="group-by-select"
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
          <label htmlFor="sort-groups-select">Sort Groups (by Amount Sum)</label>
          <select
            id="sort-groups-select"
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

      <div className="table-container">
        <table>
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isPinned = index === 0;
                  const headerStyle: React.CSSProperties = isPinned
                    ? { position: 'sticky', left: '0px', zIndex: 11 }
                    : {};
                  const headerClass = isPinned ? 'pinned-col' : '';

                  return (
                    <th
                      key={header.id}
                      data-testid={isPinned ? 'pinned-col-header' : undefined}
                      className={headerClass}
                      style={headerStyle}
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
                const leafRows = row.getLeafRows();
                const sumAmount = leafRows.reduce((sum, r) => sum + r.original.amount, 0);
                const avgUnitPrice = leafRows.reduce((sum, r) => sum + (r.original.amount / r.original.units), 0) / leafRows.length;
                const count = leafRows.length;

                return (
                  <tr
                    key={row.id}
                    data-testid="group-row"
                    data-group-value={row.groupingValue}
                    className="group-row"
                  >
                    {row.getVisibleCells().map((cell, index) => {
                      const isPinned = index === 0;
                      const cellStyle: React.CSSProperties = isPinned
                        ? { position: 'sticky', left: '0px', zIndex: 10 }
                        : {};
                      const cellClass = isPinned ? 'pinned-col' : '';

                      if (index === 0) {
                        return (
                          <td key={cell.id} className={cellClass} style={cellStyle}>
                            <button
                              data-testid="group-toggle"
                              className="group-toggle-btn"
                              onClick={() => row.toggleExpanded()}
                              style={{ marginRight: '8px' }}
                            >
                              {row.getIsExpanded() ? '▼' : '▶'}
                            </button>
                            <span>{row.groupingValue as string}</span>
                          </td>
                        );
                      }

                      if (cell.column.id === 'amount') {
                        return (
                          <td key={cell.id} className={cellClass} style={cellStyle}>
                            <span data-testid="group-sum-amount">{sumAmount}</span>
                          </td>
                        );
                      }

                      if (cell.column.id === 'unitPrice') {
                        return (
                          <td key={cell.id} className={cellClass} style={cellStyle}>
                            <span data-testid="group-avg-unit-price">{Math.round(avgUnitPrice * 100) / 100}</span>
                          </td>
                        );
                      }

                      if (cell.column.id === 'units') {
                        return (
                          <td key={cell.id} className={cellClass} style={cellStyle}>
                            <span data-testid="group-count">{count}</span>
                          </td>
                        );
                      }

                      return (
                        <td key={cell.id} className={cellClass} style={cellStyle}>
                          {/* Empty cell for other columns */}
                        </td>
                      );
                    })}
                  </tr>
                );
              } else {
                const groupValue = groupBy !== 'none' ? row.original[groupBy as keyof SalesRow] : undefined;

                return (
                  <tr
                    key={row.id}
                    data-testid="data-row"
                    data-group-value={groupValue}
                  >
                    {row.getVisibleCells().map((cell, index) => {
                      const isPinned = index === 0;
                      const cellStyle: React.CSSProperties = isPinned
                        ? { position: 'sticky', left: '0px', zIndex: 10 }
                        : {};
                      const cellClass = isPinned ? 'pinned-col' : '';

                      if (cell.column.id === 'amount') {
                        return (
                          <td
                            key={cell.id}
                            data-testid="cell-amount"
                            className={cellClass}
                            style={cellStyle}
                          >
                            {cell.getValue() as number}
                          </td>
                        );
                      }

                      return (
                        <td
                          key={cell.id}
                          className={cellClass}
                          style={cellStyle}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              }
            })}
          </tbody>
          <tfoot>
            <tr className="grand-total-row">
              {table.getVisibleFlatColumns().map((column, index) => {
                const isPinned = index === 0;
                const cellStyle: React.CSSProperties = isPinned
                  ? { position: 'sticky', left: '0px', zIndex: 10 }
                  : {};
                const cellClass = isPinned ? 'pinned-col' : '';

                if (index === 0) {
                  return (
                    <td key={column.id} className={cellClass} style={cellStyle}>
                      Grand Total
                    </td>
                  );
                }

                if (column.id === 'amount') {
                  return (
                    <td
                      key={column.id}
                      data-testid="grand-total-amount"
                      className={cellClass}
                      style={cellStyle}
                    >
                      {grandTotalAmount}
                    </td>
                  );
                }

                return (
                  <td key={column.id} className={cellClass} style={cellStyle}>
                    {/* Empty cell for other columns */}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
