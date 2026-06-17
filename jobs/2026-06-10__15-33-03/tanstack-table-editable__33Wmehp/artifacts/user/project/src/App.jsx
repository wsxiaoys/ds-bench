import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from '@tanstack/react-table';
import { useForm } from '@tanstack/react-form';
import { defaultData } from './data';
import './App.css';

function EditableRow({ row, onSave, onCancel }) {
  const originalData = row.original;

  const form = useForm({
    defaultValues: {
      name: originalData.name,
      email: originalData.email,
      role: originalData.role,
    },
    onSubmit: async ({ value }) => {
      onSave({ ...originalData, ...value });
    },
  });

  return (
    <tr className="editing-row">
      <td>{originalData.id}</td>
      <td>
        <form.Field
          name="name"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === '') {
                return 'Name is required';
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="field-cell">
              <input
                type="text"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className={field.state.meta.errors.length > 0 ? 'input-error' : ''}
              />
              {field.state.meta.errors.length > 0 && (
                <span className="error-text">
                  {field.state.meta.errors[0]}
                </span>
              )}
            </div>
          )}
        </form.Field>
      </td>
      <td>
        <form.Field
          name="email"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === '') {
                return 'Email is required';
              }
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                return 'Invalid email format';
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="field-cell">
              <input
                type="text"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className={field.state.meta.errors.length > 0 ? 'input-error' : ''}
              />
              {field.state.meta.errors.length > 0 && (
                <span className="error-text">
                  {field.state.meta.errors[0]}
                </span>
              )}
            </div>
          )}
        </form.Field>
      </td>
      <td>
        <form.Field
          name="role"
          validators={{
            onChange: ({ value }) => {
              if (!value || value.trim() === '') {
                return 'Role is required';
              }
              return undefined;
            },
          }}
        >
          {(field) => (
            <div className="field-cell">
              <select
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                className={field.state.meta.errors.length > 0 ? 'input-error' : ''}
              >
                <option value="Admin">Admin</option>
                <option value="Editor">Editor</option>
                <option value="Viewer">Viewer</option>
              </select>
              {field.state.meta.errors.length > 0 && (
                <span className="error-text">
                  {field.state.meta.errors[0]}
                </span>
              )}
            </div>
          )}
        </form.Field>
      </td>
      <td>
        <div className="action-buttons">
          <button
            type="button"
            className="btn btn-save"
            onClick={() => form.handleSubmit()}
          >
            Save
          </button>
          <button type="button" className="btn btn-cancel" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </td>
    </tr>
  );
}

function App() {
  const [data, setData] = useState(defaultData);
  const [editingRowId, setEditingRowId] = useState(null);

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
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <button
          className="btn btn-edit"
          onClick={() => setEditingRowId(row.original.id)}
        >
          Edit
        </button>
      ),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleSave = (updatedRow) => {
    setData((prev) =>
      prev.map((row) => (row.id === updatedRow.id ? updatedRow : row))
    );
    setEditingRowId(null);
  };

  const handleCancel = () => {
    setEditingRowId(null);
  };

  return (
    <div className="app-container">
      <h1>User Management</h1>
      <table className="data-table">
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
          {table.getRowModel().rows.map((row) =>
            editingRowId === row.original.id ? (
              <EditableRow
                key={row.id}
                row={row}
                onSave={handleSave}
                onCancel={handleCancel}
              />
            ) : (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;