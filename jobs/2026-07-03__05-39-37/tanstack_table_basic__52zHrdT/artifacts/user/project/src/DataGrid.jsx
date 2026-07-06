import { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
} from '@tanstack/react-table'

// Static data: at least 3 rows with id, name, email columns
const data = [
  { id: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
  { id: 2, name: 'Alan Turing', email: 'alan@example.com' },
  { id: 3, name: 'Grace Hopper', email: 'grace@example.com' },
]

export default function DataGrid() {
  const columns = useMemo(
    () => [
      { header: 'ID', accessorKey: 'id' },
      { header: 'Name', accessorKey: 'name' },
      { header: 'Email', accessorKey: 'email' },
    ],
    []
  )

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder
                  ? null
                  : typeof header.column.columnDef.header === 'function'
                    ? header.column.columnDef.header(header.getContext())
                    : header.column.columnDef.header}
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
                {typeof cell.column.columnDef.cell === 'function'
                  ? cell.column.columnDef.cell(cell.getContext())
                  : cell.getValue()}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}