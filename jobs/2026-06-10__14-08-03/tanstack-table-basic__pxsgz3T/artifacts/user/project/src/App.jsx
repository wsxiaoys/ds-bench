import React from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table'

const defaultData = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'alice@example.com',
  },
  {
    id: 2,
    name: 'Bob Smith',
    email: 'bob@example.com',
  },
  {
    id: 3,
    name: 'Charlie Brown',
    email: 'charlie@example.com',
  },
]

const columns = [
  {
    header: 'ID',
    accessorKey: 'id',
  },
  {
    header: 'Name',
    accessorKey: 'name',
  },
  {
    header: 'Email',
    accessorKey: 'email',
  },
]

function App() {
  const [data] = React.useState(() => [...defaultData])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="p-2">
      <table>
        <thead>
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map(header => (
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
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>
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
