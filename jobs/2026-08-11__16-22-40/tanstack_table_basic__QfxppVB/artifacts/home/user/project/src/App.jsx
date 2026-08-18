import React, { useMemo } from 'react'
import {
  tableFeatures,
  useTable,
  flexRender,
} from '@tanstack/react-table'
import './App.css'

function App() {
  const data = useMemo(
    () => [
      { id: 1, name: 'John Doe', email: 'john.doe@example.com', role: 'Admin' },
      { id: 2, name: 'Jane Smith', email: 'jane.smith@example.com', role: 'User' },
      { id: 3, name: 'Bob Johnson', email: 'bob.johnson@example.com', role: 'Editor' },
      { id: 4, name: 'Alice Williams', email: 'alice.williams@example.com', role: 'User' },
      { id: 5, name: 'Charlie Brown', email: 'charlie.brown@example.com', role: 'Contributor' },
    ],
    []
  )

  const columns = useMemo(
    () => [
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
    ],
    []
  )

  const features = useMemo(() => tableFeatures({}), [])

  const table = useTable({
    features,
    data,
    columns,
  })

  return (
    <div className="container">
      <header className="header">
        <h1>Basic Data Grid</h1>
        <p className="subtitle">Built with TanStack Table v9 & React</p>
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

      <footer className="footer">
        <p>Total Rows: {data.length}</p>
      </footer>
    </div>
  )
}

export default App
