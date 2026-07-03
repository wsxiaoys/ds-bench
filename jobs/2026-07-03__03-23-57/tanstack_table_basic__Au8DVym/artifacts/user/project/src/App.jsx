import React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'
import './App.css'

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
  {
    accessorKey: 'role',
    header: 'Role',
  },
]

const data = [
  { id: 1, name: 'Alice Smith', email: 'alice@example.com', role: 'Administrator' },
  { id: 2, name: 'Bob Jones', email: 'bob@example.com', role: 'Developer' },
  { id: 3, name: 'Charlie Brown', email: 'charlie@example.com', role: 'Designer' },
  { id: 4, name: 'Diana Prince', email: 'diana@example.com', role: 'Product Manager' },
]

function App() {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="container">
      <header className="app-header">
        <h1>User Directory</h1>
        <p className="subtitle">A simple data grid built with TanStack Table and React</p>
      </header>

      <main className="table-container">
        <table>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
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
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </main>

      <footer className="app-footer">
        <p>Total users: {data.length}</p>
      </footer>
    </div>
  )
}

export default App
