import React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import './App.css'

const data = [
  { id: 1, name: 'Alice Smith', email: 'alice@example.com' },
  { id: 2, name: 'Bob Jones', email: 'bob@example.com' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com' },
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
    <div style={{ padding: '40px', textAlign: 'left' }}>
      <h1>Basic Data Grid</h1>
      <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid var(--border)' }}>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <th
                  key={header.id}
                  style={{
                    border: '1px solid var(--border)',
                    padding: '12px 16px',
                    textAlign: 'left',
                    backgroundColor: 'var(--code-bg)',
                    color: 'var(--text-h)',
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
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td
                  key={cell.id}
                  style={{
                    border: '1px solid var(--border)',
                    padding: '12px 16px',
                    color: 'var(--text)',
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
