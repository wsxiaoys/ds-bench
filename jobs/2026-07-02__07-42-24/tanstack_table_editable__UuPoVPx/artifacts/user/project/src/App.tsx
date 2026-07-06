import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import {
  UserPlus,
  Edit2,
  Trash2,
  Search,
  Users,
  ShieldCheck,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import { initialUsers } from './types';
import type { User } from './types';
import { EditableRow } from './EditableRow';

const columnHelper = createColumnHelper<User>();

function App() {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');

  // Handler to start editing a row
  const handleStartEdit = (id: string) => {
    setEditingId(id);
    setIsNewUser(false);
  };

  // Handler to save an edited or new row
  const handleSave = (updatedUser: User) => {
    setUsers((prevUsers) =>
      prevUsers.map((user) => (user.id === updatedUser.id ? updatedUser : user))
    );
    setEditingId(null);
    setIsNewUser(false);
  };

  // Handler to cancel editing
  const handleCancel = () => {
    if (isNewUser) {
      // If it was a newly added row, remove it on cancel
      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== editingId));
    }
    setEditingId(null);
    setIsNewUser(false);
  };

  // Handler to delete a user
  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setIsNewUser(false);
      }
    }
  };

  // Handler to add a new blank row and put it in edit mode
  const handleAddUser = () => {
    // Generate a new sequential ID
    const maxId = users.reduce((max, u) => {
      const parsed = parseInt(u.id, 10);
      return isNaN(parsed) ? max : Math.max(max, parsed);
    }, 0);
    const nextId = (maxId + 1).toString();

    const newUser: User = {
      id: nextId,
      name: '',
      email: '',
      role: 'User',
    };

    setUsers((prevUsers) => [...prevUsers, newUser]);
    setEditingId(nextId);
    setIsNewUser(true);
  };

  // Define columns using useMemo to avoid re-renders and capture editing state
  const columns = useMemo(
    () => [
      columnHelper.accessor('id', {
        header: 'ID',
        cell: (info) => (
          <span className="font-mono text-gray-500 dark:text-gray-400 font-semibold">
            #{info.getValue()}
          </span>
        ),
      }),
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
              {info.getValue().charAt(0).toUpperCase() || '?'}
            </div>
            <span className="font-semibold text-gray-900 dark:text-white">
              {info.getValue() || <em className="text-gray-400 font-normal">No name</em>}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor('email', {
        header: 'Email',
        cell: (info) => (
          <span className="text-gray-600 dark:text-gray-300">
            {info.getValue() || <em className="text-gray-400">No email</em>}
          </span>
        ),
      }),
      columnHelper.accessor('role', {
        header: 'Role',
        cell: (info) => {
          const role = info.getValue();
          const badgeColor =
            role === 'Admin'
              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-900/50'
              : role === 'Editor'
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-900/50'
              : role === 'User'
              ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 border-green-200 dark:border-green-900/50'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700';
          return (
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badgeColor}`}
            >
              {role}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: 'actions',
        header: () => <span className="text-right block pr-4">Actions</span>,
        cell: (info) => {
          const userId = info.row.original.id;
          const isEditingSomeRow = editingId !== null;
          return (
            <div className="flex justify-end gap-2 pr-4">
              <button
                type="button"
                onClick={() => handleStartEdit(userId)}
                disabled={isEditingSomeRow}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
                  isEditingSomeRow
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 cursor-pointer'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(userId)}
                disabled={isEditingSomeRow}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 ${
                  isEditingSomeRow
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                    : 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 cursor-pointer'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          );
        },
      }),
    ],
    [editingId, users]
  );

  // Initialize TanStack Table
  const table = useReactTable({
    data: users,
    columns,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Calculate statistics for the dashboard cards
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'Admin').length;
    const editors = users.filter((u) => u.role === 'Editor').length;
    const regularUsers = users.filter((u) => u.role === 'User').length;
    return { total, admins, editors, regularUsers };
  }, [users]);

  const isEditingSomeRow = editingId !== null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center p-1.5 bg-indigo-600 rounded-lg text-white">
                <Sparkles className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 bg-clip-text text-transparent">
                TanStack Admin Portal
              </h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage system users, roles, and contact details with live validation.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={handleAddUser}
              disabled={isEditingSomeRow}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all duration-150 ${
                isEditingSomeRow
                  ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer hover:shadow-indigo-500/20'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Add User
            </button>
          </div>
        </header>

        {/* Stats Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold">{stats.total}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Administrators</p>
              <h3 className="text-2xl font-bold">{stats.admins}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Edit2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Editors</p>
              <h3 className="text-2xl font-bold">{stats.editors}</h3>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-50 dark:bg-green-950/30 flex items-center justify-center text-green-600 dark:text-green-400">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Regular Users</p>
              <h3 className="text-2xl font-bold">{stats.regularUsers}</h3>
            </div>
          </div>
        </section>

        {/* Search & Filter Toolbar */}
        <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-xs">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-950 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white transition-all"
              placeholder="Search users..."
            />
          </div>

          {isEditingSomeRow && (
            <div className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 px-3 py-1.5 rounded-lg animate-pulse">
              ⚠️ Finish editing the active row to enable table actions.
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-950/50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th
                        key={header.id}
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider"
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
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => {
                    const isEditing = row.original.id === editingId;

                    if (isEditing) {
                      return (
                        <EditableRow
                          key={row.original.id}
                          row={row}
                          onSave={handleSave}
                          onCancel={handleCancel}
                        />
                      );
                    }

                    return (
                      <tr
                        key={row.original.id}
                        className="hover:bg-gray-50/80 dark:hover:bg-gray-800/20 transition-colors duration-150"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={columns.length}
                      className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No users found. Try adjusting your search or add a new user!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
