import React, { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getSortedRowModel,
} from '@tanstack/react-table'

const salesData = [
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

function App() {
  const [groupBy, setGroupBy] = useState('none')
  const [grouping, setGrouping] = useState([])
  const [expanded, setExpanded] = useState({})
  const [sorting, setSorting] = useState([])

  const columns = useMemo(
    () => [
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
      },
      {
        accessorKey: 'units',
        header: 'Units',
      },
    ],
    []
  )

  const table = useReactTable({
    data: salesData,
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
  })

  const handleGroupByChange = (e) => {
    const value = e.target.value
    setGroupBy(value)
    setGrouping(value === 'none' ? [] : [value])
    setExpanded({}) // Reset all groups to collapsed when grouping changes
  }

  const handleSortChange = (e) => {
    const value = e.target.value
    if (value === 'none') {
      setSorting([])
    } else {
      setSorting([{ id: 'amount', desc: value === 'desc' }])
    }
  }

  const grandTotalAmount = useMemo(() => {
    return salesData.reduce((sum, row) => sum + row.amount, 0)
  }, [])

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto', color: '#1f2937', textAlign: 'left' }}>
      <header style={{ marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#111827', textAlign: 'left' }}>
          Analytical Sales Data Table
        </h1>
        <p style={{ margin: '0', color: '#4b5563', fontSize: '14px', textAlign: 'left' }}>
          An interactive sales report built with TanStack Table v8.
        </p>
      </header>

      {/* Controls Section */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
          <label htmlFor="group-by-select" style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>
            Group By Column
          </label>
          <select
            id="group-by-select"
            data-testid="group-by"
            value={groupBy}
            onChange={handleGroupByChange}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              fontSize: '14px',
              minWidth: '160px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="none">none</option>
            <option value="region">region</option>
            <option value="category">category</option>
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
          <label htmlFor="sort-groups-select" style={{ fontSize: '12px', fontWeight: 'bold', color: '#4b5563' }}>
            Sort Groups by Sum of Amount
          </label>
          <select
            id="sort-groups-select"
            data-testid="sort-groups"
            value={sorting[0]?.desc === true ? 'desc' : sorting[0]?.desc === false ? 'asc' : 'none'}
            onChange={handleSortChange}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              backgroundColor: '#fff',
              fontSize: '14px',
              minWidth: '160px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            <option value="none">none</option>
            <option value="asc">asc</option>
            <option value="desc">desc</option>
          </select>
        </div>
      </div>

      {/* Table Container with scroll support */}
      <div
        style={{
          overflowX: 'auto',
          maxWidth: '100%',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          backgroundColor: '#fff',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', borderSpacing: 0, minWidth: '800px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
              <th
                data-testid="pinned-col-header"
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 2,
                  backgroundColor: '#f9fafb',
                  textAlign: 'left',
                  padding: '12px 16px',
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#374151',
                  borderBottom: '2px solid #e5e7eb',
                  width: '180px',
                }}
              >
                Region
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#374151',
                  borderBottom: '2px solid #e5e7eb',
                  width: '180px',
                }}
              >
                Category
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#374151',
                  borderBottom: '2px solid #e5e7eb',
                  width: '180px',
                }}
              >
                Salesperson
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#374151',
                  borderBottom: '2px solid #e5e7eb',
                  width: '140px',
                }}
              >
                Amount
              </th>
              <th
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  fontWeight: '600',
                  fontSize: '14px',
                  color: '#374151',
                  borderBottom: '2px solid #e5e7eb',
                  width: '120px',
                }}
              >
                Units
              </th>
            </tr>
          </thead>
          <tbody style={{ textAlign: 'left' }}>
            {table.getRowModel().rows.map((row) => {
              if (row.getIsGrouped()) {
                const leafRows = row.leafRows
                const sumAmount = leafRows.reduce((sum, r) => sum + r.original.amount, 0)
                const avgUnitPrice = parseFloat(
                  (
                    leafRows.reduce((sum, r) => sum + r.original.amount / r.original.units, 0) /
                    leafRows.length
                  ).toFixed(4)
                )
                const count = leafRows.length

                return (
                  <tr
                    key={row.id}
                    data-testid="group-row"
                    data-group-value={row.groupingValue}
                    style={{ backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}
                  >
                    {/* Leftmost label column pinned */}
                    <td
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 1,
                        backgroundColor: '#f3f4f6',
                        padding: '12px 16px',
                        fontWeight: '600',
                        fontSize: '14px',
                        color: '#111827',
                        borderBottom: '1px solid #e5e7eb',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          data-testid="group-toggle"
                          onClick={row.getToggleExpandedHandler()}
                          style={{
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '24px',
                            height: '24px',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            backgroundColor: '#fff',
                            color: '#4b5563',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            outline: 'none',
                          }}
                        >
                          {row.getIsExpanded() ? '▼' : '▶'}
                        </button>
                        <span>{row.groupingValue}</span>
                      </div>
                    </td>

                    {/* Category cell */}
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>
                        Count: <span data-testid="group-count">{count}</span>
                      </span>
                    </td>

                    {/* Salesperson cell */}
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>
                        Avg UP: <span data-testid="group-avg-unit-price">{avgUnitPrice}</span>
                      </span>
                    </td>

                    {/* Amount cell */}
                    <td
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #e5e7eb',
                        fontWeight: '600',
                        fontSize: '14px',
                        color: '#111827',
                        textAlign: 'left',
                      }}
                    >
                      <span data-testid="group-sum-amount">{sumAmount}</span>
                    </td>

                    {/* Units cell */}
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}></td>
                  </tr>
                )
              }

              // Leaf data row
              const currentGroupValue =
                groupBy === 'region'
                  ? row.original.region
                  : groupBy === 'category'
                  ? row.original.category
                  : undefined

              return (
                <tr
                  key={row.id}
                  data-testid="data-row"
                  data-group-value={currentGroupValue}
                  style={{ borderBottom: '1px solid #e5e7eb', transition: 'background-color 0.2s', textAlign: 'left' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9fafb')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {/* Column 1: Region (sticky leftmost column) */}
                  <td
                    style={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                      backgroundColor: '#fff',
                      padding: '12px 16px',
                      fontSize: '14px',
                      color: '#374151',
                      borderBottom: '1px solid #e5e7eb',
                      textAlign: 'left',
                    }}
                  >
                    {row.original.region}
                  </td>

                  {/* Column 2: Category */}
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                    {row.original.category}
                  </td>

                  {/* Column 3: Salesperson */}
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                    {row.original.salesperson}
                  </td>

                  {/* Column 4: Amount */}
                  <td
                    data-testid="cell-amount"
                    style={{
                      padding: '12px 16px',
                      fontSize: '14px',
                      color: '#374151',
                      borderBottom: '1px solid #e5e7eb',
                      textAlign: 'left',
                    }}
                  >
                    {row.original.amount}
                  </td>

                  {/* Column 5: Units */}
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#374151', borderBottom: '1px solid #e5e7eb', textAlign: 'left' }}>
                    {row.original.units}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f9fafb', fontWeight: 'bold', borderTop: '2px solid #e5e7eb', textAlign: 'left' }}>
              <td
                style={{
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  backgroundColor: '#f9fafb',
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: '#111827',
                  textAlign: 'left',
                }}
              >
                Grand Total
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'left' }}></td>
              <td style={{ padding: '12px 16px', textAlign: 'left' }}></td>
              <td
                data-testid="grand-total-amount"
                style={{
                  padding: '12px 16px',
                  fontSize: '14px',
                  color: '#111827',
                  fontWeight: 'bold',
                  textAlign: 'left',
                }}
              >
                {grandTotalAmount}
              </td>
              <td style={{ padding: '12px 16px', textAlign: 'left' }}></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

export default App
