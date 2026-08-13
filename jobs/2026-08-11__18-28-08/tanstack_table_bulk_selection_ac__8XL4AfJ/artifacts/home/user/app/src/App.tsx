import React, { useState, useMemo } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  ColumnDef,
} from '@tanstack/react-table';

// Initialize Query Client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

interface Item {
  id: number;
  name: string;
  category: string;
  status: 'active' | 'archived';
}

interface ItemsResponse {
  rows: Item[];
  total: number;
  page: number;
  pageSize: number;
}

function AdminConsole() {
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Selection states
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());

  const queryClientInstance = useQueryClient();

  // Fetch items
  const { data, isLoading } = useQuery<ItemsResponse>({
    queryKey: ['items', statusFilter, page, pageSize],
    queryFn: async () => {
      const res = await fetch(
        `/api/items?status=${statusFilter}&page=${page}&pageSize=${pageSize}`
      );
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    },
  });

  const items = data?.rows ?? [];
  const totalCount = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Extract IDs of items on the current page
  const currentPageIds = useMemo(() => items.map((item) => item.id), [items]);

  // Selection helpers
  const isRowSelected = useMemo(() => {
    return (id: number) => {
      if (isAllSelected) {
        return !excludedIds.has(id);
      }
      return selectedIds.has(id);
    };
  }, [isAllSelected, excludedIds, selectedIds]);

  const toggleRow = (id: number) => {
    if (isAllSelected) {
      setExcludedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    }
  };

  const areAllOnPageSelected = useMemo(() => {
    return currentPageIds.length > 0 && currentPageIds.every((id) => isRowSelected(id));
  }, [currentPageIds, isRowSelected]);

  const togglePageSelection = () => {
    if (areAllOnPageSelected) {
      // Deselect all on current page
      if (isAllSelected) {
        setExcludedIds((prev) => {
          const next = new Set(prev);
          currentPageIds.forEach((id) => next.add(id));
          return next;
        });
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          currentPageIds.forEach((id) => next.delete(id));
          return next;
        });
      }
    } else {
      // Select all on current page
      if (isAllSelected) {
        setExcludedIds((prev) => {
          const next = new Set(prev);
          currentPageIds.forEach((id) => next.delete(id));
          return next;
        });
      } else {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          currentPageIds.forEach((id) => next.add(id));
          return next;
        });
      }
    }
  };

  const selectionCount = useMemo(() => {
    if (isAllSelected) {
      return Math.max(0, totalCount - excludedIds.size);
    }
    return selectedIds.size;
  }, [isAllSelected, totalCount, excludedIds, selectedIds]);

  const clearSelection = () => {
    setIsAllSelected(false);
    setSelectedIds(new Set());
    setExcludedIds(new Set());
  };

  const selectAllMatching = () => {
    setIsAllSelected(true);
    setExcludedIds(new Set());
    setSelectedIds(new Set());
  };

  const handleFilterChange = (newStatus: 'active' | 'archived') => {
    setStatusFilter(newStatus);
    setPage(1);
    clearSelection();
  };

  // Bulk Archive Mutation
  const archiveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/items/bulk-archive', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to archive items');
      return res.json();
    },
    onMutate: async (payload) => {
      // Cancel outgoing refetches
      await queryClientInstance.cancelQueries({ queryKey: ['items'] });

      // Snapshot previous items for rollback
      const previousItems = queryClientInstance.getQueryData([
        'items',
        statusFilter,
        page,
        pageSize,
      ]);

      // Snapshot selection state
      const prevSelection = { isAllSelected, selectedIds, excludedIds };

      // Optimistically clear selection
      setIsAllSelected(false);
      setSelectedIds(new Set());
      setExcludedIds(new Set());

      // Optimistically update cache
      queryClientInstance.setQueryData(
        ['items', statusFilter, page, pageSize],
        (old: any) => {
          if (!old) return old;

          if (payload.mode === 'all') {
            return {
              ...old,
              rows: [],
              total: 0,
            };
          }

          // mode: 'selected'
          const archivedIdsSet = new Set(payload.ids);
          const nextRows = old.rows.filter((row: any) => !archivedIdsSet.has(row.id));
          const removedCount = old.rows.length - nextRows.length;
          return {
            ...old,
            rows: nextRows,
            total: Math.max(0, old.total - removedCount),
          };
        }
      );

      return { previousItems, prevSelection };
    },
    onError: (err, payload, context: any) => {
      if (context?.previousItems) {
        queryClientInstance.setQueryData(
          ['items', statusFilter, page, pageSize],
          context.previousItems
        );
      }
      if (context?.prevSelection) {
        setIsAllSelected(context.prevSelection.isAllSelected);
        setSelectedIds(context.prevSelection.selectedIds);
        setExcludedIds(context.prevSelection.excludedIds);
      }
    },
    onSettled: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const handleBulkArchive = async () => {
    if (selectionCount === 0) return;

    let payload: any;
    if (isAllSelected && excludedIds.size === 0) {
      payload = { mode: 'all', status: statusFilter };
    } else if (isAllSelected) {
      // Fetch all matching IDs to filter out excluded ones
      try {
        const res = await fetch(`/api/items?status=${statusFilter}&page=1&pageSize=1000`);
        if (!res.ok) throw new Error('Failed to fetch matching items');
        const data: ItemsResponse = await res.json();
        const allIds = data.rows.map((r) => r.id);
        const ids = allIds.filter((id) => !excludedIds.has(id));
        payload = { mode: 'selected', ids };
      } catch (error) {
        console.error(error);
        return;
      }
    } else {
      payload = { mode: 'selected', ids: Array.from(selectedIds) };
    }

    archiveMutation.mutate(payload);
  };

  // Define columns for TanStack Table
  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            data-testid="select-page-checkbox"
            checked={areAllOnPageSelected}
            onChange={togglePageSelection}
            style={{ cursor: 'pointer' }}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            data-testid={`row-checkbox-${row.original.id}`}
            checked={isRowSelected(row.original.id)}
            onChange={() => toggleRow(row.original.id)}
            style={{ cursor: 'pointer' }}
          />
        ),
      },
      {
        accessorKey: 'id',
        header: 'ID',
      },
      {
        accessorKey: 'name',
        header: 'Name',
      },
      {
        accessorKey: 'category',
        header: 'Category',
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span
            style={{
              padding: '0.25rem 0.5rem',
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: row.original.status === 'active' ? '#dcfce7' : '#f3f4f6',
              color: row.original.status === 'active' ? '#15803d' : '#4b5563',
              textTransform: 'capitalize',
            }}
          >
            {row.original.status}
          </span>
        ),
      },
    ],
    [areAllOnPageSelected, isRowSelected, toggleRow, togglePageSelection]
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <div className="container">
      <h1>Items Admin Console</h1>

      <div className="card">
        {/* Status Filters */}
        <div className="filters">
          <button
            data-testid="filter-active"
            className={statusFilter === 'active' ? 'active-filter' : ''}
            onClick={() => handleFilterChange('active')}
          >
            Active
          </button>
          <button
            data-testid="filter-archived"
            className={statusFilter === 'archived' ? 'active-filter' : ''}
            onClick={() => handleFilterChange('archived')}
          >
            Archived
          </button>
        </div>

        {/* Action Bar */}
        <div className="actions-bar">
          <div className="left-actions">
            <span className="selection-info">
              Selected: <strong data-testid="selection-count">{selectionCount}</strong> of{' '}
              <strong data-testid="total-count">{totalCount}</strong> matching items
            </span>

            {areAllOnPageSelected && (
              <button
                data-testid="select-all-matching"
                onClick={selectAllMatching}
              >
                Select all {totalCount} matching items
              </button>
            )}

            {(selectionCount > 0) && (
              <button
                data-testid="clear-selection"
                className="btn-secondary"
                onClick={clearSelection}
              >
                Clear Selection
              </button>
            )}
          </div>

          <button
            data-testid="bulk-archive"
            className="btn-archive"
            onClick={handleBulkArchive}
            disabled={selectionCount === 0 || archiveMutation.isPending}
          >
            {archiveMutation.isPending ? 'Archiving...' : 'Archive Selected'}
          </button>
        </div>

        {/* Data Grid */}
        <div className="grid-container">
          {isLoading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
          ) : items.length === 0 ? (
            <div data-testid="empty-state" className="empty-state">
              No rows found for this filter.
            </div>
          ) : (
            <table>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} data-testid={`row-${row.original.id}`}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="pagination">
          <button
            data-testid="prev-page"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </button>

          <span data-testid="page-indicator" className="pagination-info">
            Page {page} of {totalPages}
          </span>

          <button
            data-testid="next-page"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminConsole />
    </QueryClientProvider>
  );
}
