import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table'
import { useForm } from '@tanstack/react-form'
import './App.css'

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const initialUsers: User[] = [
  { id: '1', name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin' },
  { id: '2', name: 'Bob Smith', email: 'bob@example.com', role: 'User' },
  { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', role: 'Editor' },
];

const columns: ColumnDef<User>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ getValue }) => <span className="id-cell">{getValue() as string}</span>,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ getValue, row, table }) => {
      const meta = table.options.meta as any;
      const isEditing = meta?.editingRowId === row.original.id;
      if (isEditing) {
        return (
          <meta.form.Field
            name="name"
            validators={{
              onChange: ({ value }: { value: string }) => !value ? 'Name is required' : undefined,
            }}
          >
            {(field: any) => (
              <div className="input-container">
                <input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className={`edit-input ${field.state.meta.errors.length ? 'input-error' : ''}`}
                  placeholder="Name"
                />
                {field.state.meta.errors.length ? (
                  <span className="error-message">{field.state.meta.errors[0]}</span>
                ) : null}
              </div>
            )}
          </meta.form.Field>
        );
      }
      return getValue() as string;
    },
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ getValue, row, table }) => {
      const meta = table.options.meta as any;
      const isEditing = meta?.editingRowId === row.original.id;
      if (isEditing) {
        return (
          <meta.form.Field
            name="email"
            validators={{
              onChange: ({ value }: { value: string }) => {
                if (!value) return 'Email is required';
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(value)) return 'Invalid email format';
                return undefined;
              },
            }}
          >
            {(field: any) => (
              <div className="input-container">
                <input
                  type="email"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className={`edit-input ${field.state.meta.errors.length ? 'input-error' : ''}`}
                  placeholder="Email"
                />
                {field.state.meta.errors.length ? (
                  <span className="error-message">{field.state.meta.errors[0]}</span>
                ) : null}
              </div>
            )}
          </meta.form.Field>
        );
      }
      return getValue() as string;
    },
  },
  {
    accessorKey: 'role',
    header: 'Role',
    cell: ({ getValue, row, table }) => {
      const meta = table.options.meta as any;
      const isEditing = meta?.editingRowId === row.original.id;
      if (isEditing) {
        return (
          <meta.form.Field
            name="role"
            validators={{
              onChange: ({ value }: { value: string }) => !value ? 'Role is required' : undefined,
            }}
          >
            {(field: any) => (
              <div className="input-container">
                <input
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className={`edit-input ${field.state.meta.errors.length ? 'input-error' : ''}`}
                  placeholder="Role"
                />
                {field.state.meta.errors.length ? (
                  <span className="error-message">{field.state.meta.errors[0]}</span>
                ) : null}
              </div>
            )}
          </meta.form.Field>
        );
      }
      return getValue() as string;
    },
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: ({ row, table }) => {
      const meta = table.options.meta as any;
      const isEditing = meta?.editingRowId === row.original.id;

      if (isEditing) {
        return (
          <div className="actions-cell">
            <button
              type="button"
              className="btn btn-save"
              onClick={(e) => {
                e.preventDefault();
                meta.form.handleSubmit();
              }}
            >
              Save
            </button>
            <button
              type="button"
              className="btn btn-cancel"
              onClick={() => meta.onCancel()}
            >
              Cancel
            </button>
          </div>
        );
      }

      return (
        <button
          type="button"
          className="btn btn-edit"
          disabled={meta?.editingRowId !== null}
          onClick={() => meta.onEdit(row.original)}
        >
          Edit
        </button>
      );
    },
  },
];

function App() {
  const [data, setData] = useState<User[]>(initialUsers);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      id: '',
      name: '',
      email: '',
      role: '',
    },
    onSubmit: async ({ value }) => {
      setData((prev) =>
        prev.map((user) => (user.id === value.id ? value : user))
      );
      setEditingRowId(null);
    },
  });

  const handleEdit = (user: User) => {
    form.reset({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setEditingRowId(user.id);
  };

  const handleCancel = () => {
    setEditingRowId(null);
    form.reset();
  };

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta: {
      editingRowId,
      form,
      onEdit: handleEdit,
      onCancel: handleCancel,
    },
  });

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>User Management Directory</h1>
        <p className="subtitle">
          Manage system users with inline editing powered by TanStack Table and TanStack Form.
        </p>
      </header>

      <main className="table-wrapper">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} style={{ width: header.column.getSize() }}>
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
              <tr
                key={row.id}
                className={editingRowId === row.original.id ? 'row-editing' : ''}
              >
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
    </div>
  );
}

export default App;
