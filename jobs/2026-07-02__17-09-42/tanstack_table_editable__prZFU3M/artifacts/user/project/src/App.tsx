import { useMemo, useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { initialUsers } from './data';
import type { User } from './types';
import { EditableRow } from './EditableRow';
import './App.css';

function App() {
  const [data, setData] = useState<User[]>(() => initialUsers);
  const [editingId, setEditingId] = useState<number | null>(null);

  const columns = useMemo<ColumnDef<User, unknown>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
        cell: (info) => info.getValue<number>(),
      },
      {
        accessorKey: 'name',
        header: 'Name',
        cell: (info) => info.getValue<string>(),
      },
      {
        accessorKey: 'email',
        header: 'Email',
        cell: (info) => info.getValue<string>(),
      },
      {
        accessorKey: 'role',
        header: 'Role',
        cell: (info) => info.getValue<string>(),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <button
            type="button"
            className="btn-edit"
            onClick={() => setEditingId(row.original.id)}
            disabled={editingId !== null}
          >
            Edit
          </button>
        ),
      },
    ],
    [editingId],
  );

  // Silence unused-variable warning for the createColumnHelper helper;
  // we rely on the inferred ColumnDef type above for portability.
  void createColumnHelper<User>();

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleSave = (updatedUser: User) => {
    setData((prev) =>
      prev.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
    );
    setEditingId(null);
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Users</h1>
        <p className="app-subtitle">
          Click the <strong>Edit</strong> button on a row to update its fields
          inline. Powered by TanStack Table &amp; TanStack Form.
        </p>
      </header>
      <main className="app-main">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const user = row.original;
                const isEditing = editingId === user.id;
                if (isEditing) {
                  return (
                    <EditableRow
                      key={row.id}
                      user={user}
                      onSave={handleSave}
                      onCancel={handleCancel}
                    />
                  );
                }
                return (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default App;
