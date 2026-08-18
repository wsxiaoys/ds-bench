import React, { useState } from 'react';
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
  createColumnHelper,
} from '@tanstack/react-table';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function MainApp() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);

  // Fetch paginated items
  const { data, isLoading, isError } = useQuery({
    queryKey: ['items', status, page, pageSize],
    queryFn: async () => {
      const res = await fetch(`/api/items?status=${status}&page=${page}&pageSize=${pageSize}`);
      if (!res.ok) {
        throw new Error('Failed to fetch items');
      }
      return res.json();
    },
  });

  const currentRows = data?.rows ?? [];
  const totalCount = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(totalCount / pageSize));

  // Determine if all rows on current page are selected
  const isPageAllSelected =
    currentRows.length > 0 &&
    currentRows.every((row: any) => {
      if (isAllSelected) {
        return !excludedIds.has(row.id);
      } else {
        return selectedIds.has(row.id);
      }
    });

  // Calculate current selection count
  const selectionCount = isAllSelected
    ? Math.max(0, totalCount - excludedIds.size)
    : selectedIds.size;

  // Handle single row checkbox toggle
  const handleRowCheckboxToggle = (id: number, checked: boolean) => {
    if (isAllSelected) {
      const nextExcluded = new Set(excludedIds);
      if (checked) {
        nextExcluded.delete(id);
      } else {
        nextExcluded.add(id);
      }
      setExcludedIds(nextExcluded);
    } else {
      const nextSelected = new Set(selectedIds);
      if (checked) {
        nextSelected.add(id);
      } else {
        nextSelected.delete(id);
      }
      setSelectedIds(nextSelected);
    }
  };

  // Handle page-level checkbox toggle
  const handlePageCheckboxToggle = (checked: boolean) => {
    if (checked) {
      if (isAllSelected) {
        const nextExcluded = new Set(excludedIds);
        currentRows.forEach((row: any) => nextExcluded.delete(row.id));
        setExcludedIds(nextExcluded);
      } else {
        const nextSelected = new Set(selectedIds);
        currentRows.forEach((row: any) => nextSelected.add(row.id));
        setSelectedIds(nextSelected);
      }
    } else {
      if (isAllSelected) {
        const nextExcluded = new Set(excludedIds);
        currentRows.forEach((row: any) => nextExcluded.add(row.id));
        setExcludedIds(nextExcluded);
      } else {
        const nextSelected = new Set(selectedIds);
        currentRows.forEach((row: any) => nextSelected.delete(row.id));
        setSelectedIds(nextSelected);
      }
    }
  };

  // Bulk archive mutation with optimistic updates
  const bulkArchiveMutation = useMutation({
    mutationFn: async () => {
      let payload: any;
      if (isAllSelected) {
        if (excludedIds.size === 0) {
          payload = { mode: 'all', status };
        } else {
          // Fetch all matching IDs to filter out excluded ones
          const res = await fetch(`/api/items?status=${status}&page=1&pageSize=10000`);
          if (!res.ok) throw new Error('Failed to fetch matching items');
          const data = await res.json();
          const allIds = data.rows.map((r: any) => r.id);
          const finalIds = allIds.filter((id: number) => !excludedIds.has(id));
          payload = { mode: 'selected', ids: finalIds };
        }
      } else {
        payload = { mode: 'selected', ids: Array.from(selectedIds) };
      }

      const res = await fetch('/api/items/bulk-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Bulk archive failed');
      return res.json();
    },
    onMutate: async () => {
      const queryKey = ['items', status, page, pageSize];
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData(queryKey);

      // Determine which IDs on the current page are being archived
      const affectedIdsOnPage = currentRows
        .filter((row: any) => {
          if (isAllSelected) {
            return !excludedIds.has(row.id);
          } else {
            return selectedIds.has(row.id);
          }
        })
        .map((row: any) => row.id);

      // Optimistically update the query cache
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          rows: old.rows.map((row: any) => {
            if (affectedIdsOnPage.includes(row.id)) {
              return { ...row, status: 'archived' };
            }
            return row;
          }),
          total: Math.max(0, old.total - (isAllSelected ? (old.total - excludedIds.size) : selectedIds.size)),
        };
      });

      return { previousData };
    },
    onError: (err, variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['items', status, page, pageSize], context.previousData);
      }
    },
    onSuccess: () => {
      // Clear selection on success
      setSelectedIds(new Set());
      setExcludedIds(new Set());
      setIsAllSelected(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const handleFilterChange = (newStatus: 'active' | 'archived') => {
    setStatus(newStatus);
    setPage(1);
    // Clear selection on filter change
    setSelectedIds(new Set());
    setExcludedIds(new Set());
    setIsAllSelected(false);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setExcludedIds(new Set());
    setIsAllSelected(false);
  };

  const handleSelectAllMatching = () => {
    setIsAllSelected(true);
    setSelectedIds(new Set());
    setExcludedIds(new Set());
  };

  // TanStack Table setup
  const columnHelper = createColumnHelper<any>();
  const columns = [
    columnHelper.accessor('id', {
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          data-testid="select-page-checkbox"
          checked={isPageAllSelected}
          onChange={(e) => handlePageCheckboxToggle(e.target.checked)}
        />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const isChecked = isAllSelected ? !excludedIds.has(item.id) : selectedIds.has(item.id);
        return (
          <input
            type="checkbox"
            data-testid={`row-checkbox-${item.id}`}
            checked={isChecked}
            onChange={(e) => handleRowCheckboxToggle(item.id, e.target.checked)}
          />
        );
      },
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const val = info.getValue();
        return <span className={`badge badge-${val}`}>{val}</span>;
      },
    }),
  ];

  const table = useReactTable({
    data: currentRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: lastPage,
  });

  return (
    <div className="container">
      <div className="card">
        <h1>Items Admin Console</h1>

        {/* Always-accurate selection summary */}
        <div style={{ marginBottom: '1rem', padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb', fontSize: '0.95rem' }}>
          <span>Total matching current filter: </span>
          <strong data-testid="total-count">{totalCount}</strong>
          <span style={{ margin: '0 1rem', color: '#d1d5db' }}>|</span>
          <span>Selected across all pages: </span>
          <strong data-testid="selection-count">{selectionCount}</strong>
        </div>

        {/* Filter and Bulk Actions Bar */}
        <div className="filters-bar">
          <div className="btn-group">
            <button
              data-testid="filter-active"
              onClick={() => handleFilterChange('active')}
              className={`btn ${status === 'active' ? 'btn-active-filter' : 'btn-inactive-filter'}`}
            >
              Active
            </button>
            <button
              data-testid="filter-archived"
              onClick={() => handleFilterChange('archived')}
              className={`btn ${status === 'archived' ? 'btn-active-filter' : 'btn-inactive-filter'}`}
            >
              Archived
            </button>
          </div>

          <div className="btn-group">
            <button
              data-testid="clear-selection"
              onClick={handleClearSelection}
              disabled={selectionCount === 0}
              className="btn btn-secondary"
            >
              Clear Selection
            </button>
            <button
              data-testid="bulk-archive"
              onClick={() => bulkArchiveMutation.mutate()}
              disabled={selectionCount === 0 || bulkArchiveMutation.isPending}
              className="btn btn-danger"
            >
              {bulkArchiveMutation.isPending ? 'Archiving...' : 'Bulk Archive'}
            </button>
          </div>
        </div>

        {/* Selection Banner with Select All Matching Button */}
        {isPageAllSelected && (
          <div className="selection-info-banner">
            <div>
              All rows on this page are selected.
            </div>
            <button
              data-testid="select-all-matching"
              onClick={handleSelectAllMatching}
              disabled={isAllSelected && excludedIds.size === 0}
              className="btn btn-primary"
            >
              {isAllSelected && excludedIds.size === 0
                ? 'All matching items selected across all pages'
                : `Select all ${totalCount} matching items across all pages`}
            </button>
          </div>
        )}

        {/* Data Grid */}
        <div className="table-container">
          {isLoading ? (
            <div className="empty-state">Loading items...</div>
          ) : isError ? (
            <div className="empty-state">Error loading items.</div>
          ) : currentRows.length === 0 ? (
            <div data-testid="empty-state" className="empty-state">
              No items found matching the current filter.
            </div>
          ) : (
            <table>
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className={header.id === 'select' ? 'checkbox-cell' : ''}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((tableRow) => {
                  const item = tableRow.original;
                  return (
                    <tr key={tableRow.id} data-testid={`row-${item.id}`}>
                      {tableRow.getVisibleCells().map((cell) => (
                        <td key={cell.id} className={cell.column.id === 'select' ? 'checkbox-cell' : ''}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {!isLoading && !isError && currentRows.length > 0 && (
          <div className="pagination-bar">
            <div data-testid="page-indicator">
              Page {page} of {lastPage}
            </div>
            <div className="btn-group">
              <button
                data-testid="prev-page"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary"
              >
                Previous
              </button>
              <button
                data-testid="next-page"
                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                disabled={page === lastPage}
                className="btn btn-secondary"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MainApp />
    </QueryClientProvider>
  );
}
