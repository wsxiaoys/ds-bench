import React, { useState, useMemo, createContext, useContext } from 'react';
import {
  useLegacyTable,
  getCoreRowModel,
} from '@tanstack/react-table/legacy';
import { flexRender } from '@tanstack/react-table';
import { useForm } from '@tanstack/react-form';
import './App.css';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const FormContext = createContext<any>(null);

interface EditRowWrapperProps {
  row: any;
  onSave: (values: { name: string; email: string; role: string }) => void;
}

const EditRowWrapper: React.FC<EditRowWrapperProps> = ({ row, onSave }) => {
  const form = useForm({
    defaultValues: {
      name: row.original.name,
      email: row.original.email,
      role: row.original.role,
    },
    onSubmit: async ({ value }) => {
      onSave(value);
    },
  });

  return (
    <FormContext.Provider value={form}>
      <tr className="bg-purple-50/40 dark:bg-purple-950/20 border-b border-purple-200 dark:border-purple-900/50 transition-colors">
        {row.getVisibleCells().map((cell: any) => (
          <td
            key={cell.id}
            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 align-middle"
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        ))}
      </tr>
    </FormContext.Provider>
  );
};

export default function App() {
  const [data, setData] = useState<User[]>([
    { id: '1', name: 'Alice Smith', email: 'alice@example.com', role: 'Admin' },
    { id: '2', name: 'Bob Jones', email: 'bob@example.com', role: 'User' },
    { id: '3', name: 'Charlie Brown', email: 'charlie@example.com', role: 'Editor' },
  ]);

  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEdit = (user: User) => {
    setEditingId(user.id);
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const handleSave = (updatedValues: { name: string; email: string; role: string }) => {
    setData((prev) =>
      prev.map((user) =>
        user.id === editingId ? { ...user, ...updatedValues } : user
      )
    );
    setEditingId(null);
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: 'id',
        header: () => <span className="text-left block">ID</span>,
        cell: ({ getValue }: any) => (
          <span className="font-mono text-sm font-semibold text-gray-500 dark:text-gray-400 block text-left">
            {getValue()}
          </span>
        ),
      },
      {
        accessorKey: 'name',
        header: () => <span className="text-left block">Name</span>,
        cell: ({ getValue }: any) => {
          const form = useContext(FormContext);
          if (form) {
            return (
              <form.Field
                name="name"
                validators={{
                  onChange: ({ value }: { value: string }) => {
                    if (!value || value.trim() === '') {
                      return 'Name is required';
                    }
                    return undefined;
                  },
                }}
              >
                {(field: any) => (
                  <div className="flex flex-col text-left">
                    <input
                      type="text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      placeholder="Enter name"
                    />
                    {field.state.meta.errors.length ? (
                      <span className="text-xs text-red-500 mt-1 font-medium">
                        {field.state.meta.errors[0]}
                      </span>
                    ) : null}
                  </div>
                )}
              </form.Field>
            );
          }
          return (
            <span className="font-medium text-gray-900 dark:text-gray-100 block text-left">
              {getValue()}
            </span>
          );
        },
      },
      {
        accessorKey: 'email',
        header: () => <span className="text-left block">Email</span>,
        cell: ({ getValue }: any) => {
          const form = useContext(FormContext);
          if (form) {
            return (
              <form.Field
                name="email"
                validators={{
                  onChange: ({ value }: { value: string }) => {
                    if (!value || value.trim() === '') {
                      return 'Email is required';
                    }
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(value)) {
                      return 'Invalid email format';
                    }
                    return undefined;
                  },
                }}
              >
                {(field: any) => (
                  <div className="flex flex-col text-left">
                    <input
                      type="email"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                      placeholder="Enter email"
                    />
                    {field.state.meta.errors.length ? (
                      <span className="text-xs text-red-500 mt-1 font-medium">
                        {field.state.meta.errors[0]}
                      </span>
                    ) : null}
                  </div>
                )}
              </form.Field>
            );
          }
          return (
            <span className="text-gray-600 dark:text-gray-300 block text-left">
              {getValue()}
            </span>
          );
        },
      },
      {
        accessorKey: 'role',
        header: () => <span className="text-left block">Role</span>,
        cell: ({ getValue }: any) => {
          const form = useContext(FormContext);
          if (form) {
            return (
              <form.Field
                name="role"
                validators={{
                  onChange: ({ value }: { value: string }) => {
                    if (!value || value.trim() === '') {
                      return 'Role is required';
                    }
                    return undefined;
                  },
                }}
              >
                {(field: any) => (
                  <div className="flex flex-col text-left">
                    <select
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    >
                      <option value="">Select Role</option>
                      <option value="Admin">Admin</option>
                      <option value="User">User</option>
                      <option value="Editor">Editor</option>
                    </select>
                    {field.state.meta.errors.length ? (
                      <span className="text-xs text-red-500 mt-1 font-medium">
                        {field.state.meta.errors[0]}
                      </span>
                    ) : null}
                  </div>
                )}
              </form.Field>
            );
          }
          const role = getValue();
          let badgeColor = 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
          if (role === 'Admin') badgeColor = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
          if (role === 'Editor') badgeColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
          if (role === 'User') badgeColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';

          return (
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${badgeColor} text-left`}>
              {role}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: () => <span className="text-right block">Actions</span>,
        cell: ({ row }: any) => {
          const form = useContext(FormContext);
          if (form) {
            return (
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => form.handleSubmit()}
                  className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="px-3.5 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            );
          }
          return (
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => handleEdit(row.original)}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow transition-all cursor-pointer"
              >
                Edit
              </button>
            </div>
          );
        },
      },
    ],
    [editingId, handleCancel, handleEdit]
  );

  const table = useLegacyTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight sm:text-5xl">
            User Directory
          </h1>
          <p className="mt-3 max-w-2xl mx-auto text-lg text-gray-500 dark:text-gray-400 sm:mt-4">
            Manage your users with inline editing powered by{' '}
            <span className="font-semibold text-purple-600 dark:text-purple-400">TanStack Table</span> and{' '}
            <span className="font-semibold text-purple-600 dark:text-purple-400">TanStack Form</span>.
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white dark:bg-gray-900 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Active Users</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Edit user names, emails, and roles inline in real-time.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                {table.getHeaderGroups().map((headerGroup: any) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header: any) => (
                      <th
                        key={header.id}
                        scope="col"
                        className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
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
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {table.getRowModel().rows.map((row: any) => {
                  const isEditing = editingId === row.original.id;
                  if (isEditing) {
                    return (
                      <EditRowWrapper
                        key={row.id}
                        row={row}
                        onSave={handleSave}
                      />
                    );
                  }
                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors duration-150"
                    >
                      {row.getVisibleCells().map((cell: any) => (
                        <td
                          key={cell.id}
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 align-middle"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">No users found.</p>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
          Built with React 19, Vite, Tailwind CSS v4, TanStack Table, and TanStack Form.
        </div>
      </div>
    </div>
  );
}
