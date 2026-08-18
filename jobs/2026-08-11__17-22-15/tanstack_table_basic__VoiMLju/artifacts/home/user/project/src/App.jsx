import React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import './App.css'

const data = [
  { id: 1, name: 'John Doe', email: 'john@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  { id: 3, name: 'Bob Johnson', email: 'bob@example.com' },
]

const columns = [
  {
    accessorKey: 'id',
    header: 'ID',
  },
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
]

function App() {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>Basic Data Grid</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)' }}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} style={{ backgroundColor: 'var(--code-bg)' }}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  style={{
                    borderBottom: '2px solid var(--border)',
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    color: 'var(--text-h)'
                  }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
              {row.getVisibleCells().map(cell => (
                <td
                  key={cell.id}
                  style={{
                    padding: '12px 16px',
                    color: 'var(--text)'
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default App
