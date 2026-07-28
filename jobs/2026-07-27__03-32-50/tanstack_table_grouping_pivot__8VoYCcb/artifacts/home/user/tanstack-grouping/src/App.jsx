import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table'
import './App.css'

// ---------------------------------------------------------------------------
// Fixed in-memory dataset (12 rows)
// ---------------------------------------------------------------------------
const data = [
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
]

// Render a number as a plain string: no currency symbol, no thousands
// separators, at most a single decimal point.
function formatNumber(n) {
  if (n === undefined || n === null || Number.isNaN(n)) return ''
  const rounded = Math.round(n * 100) / 100
  return String(rounded)
}

const columnHelper = createColumnHelper()

const columns = [
  columnHelper.accessor('region', {
    id: 'region',
    header: 'Region',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('category', {
    id: 'category',
    header: 'Category',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('salesperson', {
    id: 'salesperson',
    header: 'Salesperson',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('amount', {
    id: 'amount',
    header: 'Amount',
    aggregationFn: 'sum',
    cell: (info) => formatNumber(info.getValue()),
  }),
  columnHelper.accessor('units', {
    id: 'units',
    header: 'Units',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor((row) => row.amount / row.units, {
    id: 'unitPrice',
    header: 'Unit Price',
    // Average of the per-row unit prices belonging to the group.
    aggregationFn: (columnId, leafRows) => {
      if (leafRows.length === 0) return 0
      const total = leafRows.reduce((sum, r) => sum + r.getValue(columnId), 0)
      return total / leafRows.length
    },
    cell: (info) => formatNumber(info.getValue()),
  }),
]

const GRAND_TOTAL_AMOUNT = data.reduce((sum, r) => sum + r.amount, 0)

function GroupRow({ row }) {
  const groupValue = row.groupingValue
  const sumAmount = row.getValue('amount')
  const avgUnitPrice = row.getValue('unitPrice')
  const count = row.subRows.length

  return (
    <tr data-testid="group-row" data-group-value={groupValue} className="group-row">
      <td
        colSpan={row.getVisibleCells().length}
        className="group-cell pinned-cell"
        style={{ position: 'sticky', left: 0 }}
      >
        <div className="group-cell-inner">
          <button
            type="button"
            data-testid="group-toggle"
            className="group-toggle"
            aria-expanded={row.getIsExpanded()}
            onClick={row.getToggleExpandedHandler()}
          >
            {row.getIsExpanded() ? '\u25BC' : '\u25B6'}
          </button>
          <span className="group-label">{groupValue}</span>
          <span className="group-agg">
            Sum Amount: <strong data-testid="group-sum-amount">{formatNumber(sumAmount)}</strong>
          </span>
          <span className="group-agg">
            Avg Unit Price:{' '}
            <strong data-testid="group-avg-unit-price">{formatNumber(avgUnitPrice)}</strong>
          </span>
          <span className="group-agg">
            Count: <strong data-testid="group-count">{count}</strong>
          </span>
        </div>
      </td>
    </tr>
  )
}

function DataRow({ row, groupByKey }) {
  const groupValue = groupByKey ? row.original[groupByKey] : undefined
  return (
    <tr data-testid="data-row" data-group-value={groupValue} className="data-row">
      {row.getVisibleCells().map((cell) => {
        const isPinned = cell.column.getIsPinned()
        const style = isPinned
          ? { position: 'sticky', left: `${cell.column.getStart('left')}px` }
          : undefined
        return (
          <td
            key={cell.id}
            style={style}
            className={isPinned ? 'pinned-cell' : undefined}
            data-testid={cell.column.id === 'amount' ? 'cell-amount' : undefined}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        )
      })}
    </tr>
  )
}

function App() {
  const [groupBySelect, setGroupBySelect] = useState('none')
  const [sortGroupsSelect, setSortGroupsSelect] = useState('none')

  const [grouping, setGrouping] = useState([])
  const [expanded, setExpanded] = useState({})
  const [sorting, setSorting] = useState([])

  const table = useReactTable({
    data,
    columns,
    state: { grouping, expanded, sorting },
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onSortingChange: setSorting,
    groupedColumnMode: false,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      columnPinning: { left: ['region'] },
    },
  })

  const handleGroupByChange = (e) => {
    const value = e.target.value
    setGroupBySelect(value)
    setGrouping(value === 'none' ? [] : [value])
    // Every group must start collapsed whenever grouping is applied/changed.
    setExpanded({})
  }

  const handleSortGroupsChange = (e) => {
    const value = e.target.value
    setSortGroupsSelect(value)
    if (value === 'none') {
      setSorting([])
    } else {
      setSorting([{ id: 'amount', desc: value === 'desc' }])
    }
  }

  const groupByKey = grouping[0]

  return (
    <div className="app">
      <h1>Sales Data</h1>
      <div className="controls">
        <label className="control">
          Group by:
          <select data-testid="group-by" value={groupBySelect} onChange={handleGroupByChange}>
            <option value="none">None</option>
            <option value="region">Region</option>
            <option value="category">Category</option>
          </select>
        </label>
        <label className="control">
          Sort groups by amount:
          <select
            data-testid="sort-groups"
            value={sortGroupsSelect}
            onChange={handleSortGroupsChange}
          >
            <option value="none">None</option>
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </label>
      </div>

      <div className="table-container">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isPinned = header.column.getIsPinned()
                  const style = isPinned
                    ? { position: 'sticky', left: `${header.column.getStart('left')}px` }
                    : undefined
                  return (
                    <th
                      key={header.id}
                      style={style}
                      className={isPinned ? 'pinned-cell' : undefined}
                      data-testid={isPinned === 'left' ? 'pinned-col-header' : undefined}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) =>
              row.getIsGrouped() ? (
                <GroupRow key={row.id} row={row} />
              ) : (
                <DataRow key={row.id} row={row} groupByKey={groupByKey} />
              ),
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pinned-cell" style={{ position: 'sticky', left: 0 }}>
                Grand Total
              </td>
              <td data-testid="grand-total-amount">{formatNumber(GRAND_TOTAL_AMOUNT)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default App
