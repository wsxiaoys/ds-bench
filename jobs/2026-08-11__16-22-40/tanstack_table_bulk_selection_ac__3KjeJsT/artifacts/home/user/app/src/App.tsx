import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
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

interface Item {
  id: number;
  name: string;
  category: string;
  status: 'active' | 'archived';
}

const columnHelper = createColumnHelper<Item>();

export default function App() {
  const queryClient = useQueryClient();

  // State
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  // Selection state
  const [isSelectAllMatching, setIsSelectAllMatching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());

  // Fetch items
  const { data, isLoading } = useQuery({
    queryKey: ['items', statusFilter, page, pageSize],
    queryFn: async () => {
      const res = await fetch(`/api/items?status=${statusFilter}&page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json() as Promise<{ rows: Item[]; total: number; page: number; pageSize: number }>;
    },
    placeholderData: (prev) => prev,
  });

  const pageRows = data?.rows || [];
  const totalCount = data?.total || 0;

  // Derived selection values
  const isPageAllSelected = useMemo(() => {
    if (pageRows.length === 0) return false;
    return pageRows.every(row => {
      if (isSelectAllMatching) {
        return !excludedIds.has(row.id);
      } else {
        return selectedIds.has(row.id);
      }
    });
  }, [pageRows, isSelectAllMatching, excludedIds, selectedIds]);

  const isPageSomeSelected = useMemo(() => {
    if (pageRows.length === 0) return false;
    return pageRows.some(row => {
      if (isSelectAllMatching) {
        return !excludedIds.has(row.id);
      } else {
        return selectedIds.has(row.id);
      }
    });
  }, [pageRows, isSelectAllMatching, excludedIds, selectedIds]);

  const selectionCount = useMemo(() => {
    if (isSelectAllMatching) {
      return Math.max(0, totalCount - excludedIds.size);
    } else {
      return selectedIds.size;
    }
  }, [isSelectAllMatching, totalCount, excludedIds, selectedIds]);

  const isSelectionEmpty = selectionCount === 0;

  // Indeterminate state for the page-level checkbox
  const selectPageCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectPageCheckboxRef.current) {
      selectPageCheckboxRef.current.indeterminate = isPageSomeSelected && !isPageAllSelected;
    }
  }, [isPageSomeSelected, isPageAllSelected]);

  // Handlers
  const handleFilterChange = (filter: 'active' | 'archived') => {
    setStatusFilter(filter);
    setPage(1);
    setIsSelectAllMatching(false);
    setSelectedIds(new Set());
    setExcludedIds(new Set());
  };

  const handleRowCheckboxChange = (id: number) => {
    if (isSelectAllMatching) {
      setExcludedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    } else {
      setSelectedIds(prev => {
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

  const handleSelectPageToggle = () => {
    if (isPageAllSelected) {
      // Deselect all on current page
      if (isSelectAllMatching) {
        setExcludedIds(prev => {
          const next = new Set(prev);
          pageRows.forEach(row => next.add(row.id));
          return next;
        });
      } else {
        setSelectedIds(prev => {
          const next = new Set(prev);
          pageRows.forEach(row => next.delete(row.id));
          return next;
        });
      }
    } else {
      // Select all on current page
      if (isSelectAllMatching) {
        setExcludedIds(prev => {
          const next = new Set(prev);
          pageRows.forEach(row => next.delete(row.id));
          return next;
        });
      } else {
        setSelectedIds(prev => {
          const next = new Set(prev);
          pageRows.forEach(row => next.add(row.id));
          return next;
        });
      }
    }
  };

  const handleSelectAllMatching = () => {
    setIsSelectAllMatching(true);
    setExcludedIds(new Set());
    setSelectedIds(new Set());
  };

  const handleClearSelection = () => {
    setIsSelectAllMatching(false);
    setSelectedIds(new Set());
    setExcludedIds(new Set());
  };

  // Bulk archive mutation
  const bulkArchiveMutation = useMutation({
    mutationFn: async () => {
      let payload;
      if (isSelectAllMatching) {
        if (excludedIds.size === 0) {
          payload = { mode: 'all', status: statusFilter };
        } else {
          // Fetch all matching IDs to exclude the explicitly deselected ones
          const res = await fetch(`/api/items?status=${statusFilter}&page=1&pageSize=${totalCount}`);
          if (!res.ok) throw new Error('Failed to fetch matching items for archive');
          const allData = await res.json();
          const allIds = allData.rows.map((row: Item) => row.id);
          const selectedIdsList = allIds.filter((id: number) => !excludedIds.has(id));
          payload = { mode: 'selected', ids: selectedIdsList };
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
      await queryClient.cancelQueries({ queryKey: ['items'] });
      const previousItems = queryClient.getQueryData(['items', statusFilter, page, pageSize]);

      // Optimistically update current page query cache
      queryClient.setQueryData(['items', statusFilter, page, pageSize], (old: any) => {
        if (!old) return old;

        const updatedRows = old.rows.map((row: Item) => {
          const isSelected = isSelectAllMatching ? !excludedIds.has(row.id) : selectedIds.has(row.id);
          if (isSelected) {
            return { ...row, status: 'archived' };
          }
          return row;
        });

        const filteredRows = statusFilter === 'active'
          ? updatedRows.filter((row: Item) => row.status === 'active')
          : updatedRows;

        let newTotal = old.total;
        if (statusFilter === 'active') {
          if (isSelectAllMatching) {
            newTotal = excludedIds.size;
          } else {
            newTotal = Math.max(0, old.total - selectedIds.size);
          }
        }

        return {
          ...old,
          rows: filteredRows,
          total: newTotal,
        };
      });

      return { previousItems };
    },
    onError: (err, variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData(['items', statusFilter, page, pageSize], context.previousItems);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
    onSuccess: () => {
      setIsSelectAllMatching(false);
      setSelectedIds(new Set());
      setExcludedIds(new Set());
    },
  });

  // Table columns
  const columns = useMemo(() => [
    columnHelper.display({
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          data-testid="select-page-checkbox"
          ref={selectPageCheckboxRef}
          checked={isPageAllSelected}
          onChange={handleSelectPageToggle}
        />
      ),
      cell: ({ row }) => {
        const isChecked = isSelectAllMatching
          ? !excludedIds.has(row.original.id)
          : selectedIds.has(row.original.id);
        return (
          <input
            type="checkbox"
            data-testid={`row-checkbox-${row.original.id}`}
            checked={isChecked}
            onChange={() => handleRowCheckboxChange(row.original.id)}
          />
        );
      },
    }),
    columnHelper.accessor('id', {
      header: 'ID',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('name', {
      header: 'Name',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: info => (
        <span className={`badge badge-${info.getValue()}`}>
          {info.getValue()}
        </span>
      ),
    }),
  ], [isPageAllSelected, isSelectAllMatching, excludedIds, selectedIds, pageRows]);

  // TanStack Table instance
  const table = useReactTable({
    data: pageRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const lastPage = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="container">
      <header style={{ marginBottom: '2rem' }}>
        <h1>Admin Console</h1>
        <div className="filter-bar">
          <div className="filters">
            <button
              type="button"
              data-testid="filter-active"
              className={statusFilter === 'active' ? 'btn-active' : ''}
              onClick={() => handleFilterChange('active')}
            >
              Active
            </button>
            <button
              type="button"
              data-testid="filter-archived"
              className={statusFilter === 'archived' ? 'btn-active' : ''}
              onClick={() => handleFilterChange('archived')}
            >
              Archived
            </button>
          </div>
          <div>
            Total Matching: <strong data-testid="total-count">{totalCount}</strong>
          </div>
        </div>
      </header>

      {/* Selection Summary Bar */}
      <div className="selection-info">
        <div>
          Selected: <strong data-testid="selection-count">{selectionCount}</strong> items across all pages.
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isPageAllSelected && (
            <button
              type="button"
              data-testid="select-all-matching"
              className="btn-primary"
              onClick={handleSelectAllMatching}
            >
              Select all {totalCount} matching items
            </button>
          )}
          <button
            type="button"
            data-testid="clear-selection"
            onClick={handleClearSelection}
          >
            Clear Selection
          </button>
          <button
            type="button"
            data-testid="bulk-archive"
            className="btn-danger"
            disabled={isSelectionEmpty || bulkArchiveMutation.isPending}
            onClick={() => bulkArchiveMutation.mutate()}
          >
            {bulkArchiveMutation.isPending ? 'Archiving...' : 'Archive Selected'}
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading && pageRows.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
      ) : pageRows.length === 0 ? (
        <div data-testid="empty-state" className="empty-state">
          No items found.
        </div>
      ) : (
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
              <tr key={row.id} data-testid={`row-${row.original.id}`}>
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    {flexRender(
                      cell.column.columnDef.cell,
                      cell.getContext()
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {pageRows.length > 0 && (
        <div className="pagination">
          <span data-testid="page-indicator">
            Page {page} of {lastPage}
          </span>
          <div className="pagination-buttons">
            <button
              type="button"
              data-testid="prev-page"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              data-testid="next-page"
              disabled={page === lastPage}
              onClick={() => setPage(p => Math.min(lastPage, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
