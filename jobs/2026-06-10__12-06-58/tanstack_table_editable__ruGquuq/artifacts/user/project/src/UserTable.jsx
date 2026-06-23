import { useState, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { initialUsers } from './data'
import EditableRow from './EditableRow'

const columnHelper = createColumnHelper()

const displayColumns = [
  columnHelper.accessor('id', {
    header: 'ID',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('name', {
    header: 'Name',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('email', {
    header: 'Email',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('role', {
    header: 'Role',
    cell: (info) => (
      <span className={`role-badge role-${info.getValue().toLowerCase()}`}>
        {info.getValue()}
      </span>
    ),
  }),
  columnHelper.display({
    id: 'actions',
    header: 'Actions',
    cell: () => null, // rendered manually
  }),
]

export default function UserTable() {
  const [data, setData] = useState(initialUsers)
  const [editingId, setEditingId] = useState(null)

  const table = useReactTable({
    data,
    columns: displayColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleEdit = useCallback((id) => setEditingId(id), [])
  const handleCancel = useCallback(() => setEditingId(null), [])

  const handleSave = useCallback(
    (updatedUser) => {
      setData((prev) =>
        prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      )
      setEditingId(null)
    },
    []
  )

  return (
    <div className="table-container">
      <table className="user-table">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => {
            const user = row.original

            if (editingId === user.id) {
              return (
                <EditableRow
                  key={user.id}
                  row={user}
                  onSave={handleSave}
                  onCancel={handleCancel}
                />
              )
            }

            return (
              <tr key={user.id} className="display-row">
                {row.getVisibleCells().map((cell) => {
                  if (cell.column.id === 'actions') {
                    return (
                      <td key={cell.id}>
                        <button
                          className="btn btn-edit"
                          onClick={() => handleEdit(user.id)}
                          disabled={editingId !== null}
                        >
                          Edit
                        </button>
                      </td>
                    )
                  }
                  return (
                    <td key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
