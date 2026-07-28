import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

interface ItemsResponse {
  rows: Item[];
  total: number;
  page: number;
  pageSize: number;
}

export default function App() {
  const queryClient = useQueryClient();

  // State
  const [statusFilter, setStatusFilter] = React.useState<'active' | 'archived'>('active');
  const [page, setPage] = React.useState<number>(1);
  const [pageSize] = React.useState<number>(10);

  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [isAllMatchingSelected, setIsAllMatchingSelected] = React.useState<boolean>(false);
  const [excludedIds, setExcludedIds] = React.useState<Set<number>>(new Set());

  // Reset page and selection when status filter changes
  const handleFilterChange = (status: 'active' | 'archived') => {
    setStatusFilter(status);
    setPage(1);
    setSelectedIds(new Set());
    setIsAllMatchingSelected(false);
    setExcludedIds(new Set());
  };

  // Queries
  const { data: paginatedData, isLoading: isPaginatedLoading } = useQuery<ItemsResponse>({
    queryKey: ['items', 'paginated', statusFilter, page, pageSize],
    queryFn: async () => {
      const res = await fetch(`/api/items?status=${statusFilter}&page=${page}&pageSize=${pageSize}`);
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    },
  });

  // Query to get all matching rows for the current status (used for full list of IDs when doing bulk archive with exclusions)
  const { data: allItemsData } = useQuery<ItemsResponse>({
    queryKey: ['items', 'all', statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/items?status=${statusFilter}&page=1&pageSize=1000`);
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    },
  });

  const totalMatchingCount = paginatedData?.total ?? 0;
  const currentRows = paginatedData?.rows ?? [];
  const currentRowsCount = currentRows.length;

  // Helper to check if a row is selected
  const isRowSelected = React.useCallback(
    (id: number) => {
      if (isAllMatchingSelected) {
        return !excludedIds.has(id);
      }
      return selectedIds.has(id);
    },
    [isAllMatchingSelected, excludedIds, selectedIds]
  );

  // Computed selection values
  const selectedCurrentRowsCount = currentRows.filter((r) => isRowSelected(r.id)).length;
  const isPageAllSelected = currentRowsCount > 0 && selectedCurrentRowsCount === currentRowsCount;
  const isPageIndeterminate =
    currentRowsCount > 0 && selectedCurrentRowsCount > 0 && selectedCurrentRowsCount < currentRowsCount;

  const selectionCount = React.useMemo(() => {
    if (isAllMatchingSelected) {
      return Math.max(0, totalMatchingCount - excludedIds.size);
    }
    return selectedIds.size;
  }, [isAllMatchingSelected, totalMatchingCount, excludedIds, selectedIds]);

  // Handlers
  const handleRowSelectToggle = (id: number) => {
    if (isAllMatchingSelected) {
      const newExcluded = new Set(excludedIds);
      if (newExcluded.has(id)) {
        newExcluded.delete(id);
      } else {
        newExcluded.add(id);
      }
      setExcludedIds(newExcluded);
    } else {
      const newSelected = new Set(selectedIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelectedIds(newSelected);
    }
  };

  const handleSelectPageToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    const pageRowIds = currentRows.map((r) => r.id);

    if (isAllMatchingSelected) {
      const newExcluded = new Set(excludedIds);
      if (checked) {
        // Select all on page -> remove them from excluded
        pageRowIds.forEach((id) => newExcluded.delete(id));
      } else {
        // Deselect all on page -> add them to excluded
        pageRowIds.forEach((id) => newExcluded.add(id));
      }
      setExcludedIds(newExcluded);
    } else {
      const newSelected = new Set(selectedIds);
      if (checked) {
        // Select all on page -> add them to selected
        pageRowIds.forEach((id) => newSelected.add(id));
      } else {
        // Deselect all on page -> remove them from selected
        pageRowIds.forEach((id) => newSelected.delete(id));
      }
      setSelectedIds(newSelected);
    }
  };

  const handleSelectAllMatching = () => {
    setIsAllMatchingSelected(true);
    setExcludedIds(new Set());
    setSelectedIds(new Set());
  };

  const handleClearSelection = () => {
    setIsAllMatchingSelected(false);
    setExcludedIds(new Set());
    setSelectedIds(new Set());
  };

  // Mutation
  const archiveMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch('/api/items/bulk-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to bulk archive');
      return res.json();
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['items'] });

      const previousPaginated = queryClient.getQueryData(['items', 'paginated', statusFilter, page, pageSize]);
      const previousAll = queryClient.getQueryData(['items', 'all', statusFilter]);

      let archivedIdsSet = new Set<number>();
      if (variables.mode === 'all') {
        const allMatchingIds = previousAll ? (previousAll as ItemsResponse).rows.map((r) => r.id) : [];
        archivedIdsSet = new Set(allMatchingIds);
      } else {
        archivedIdsSet = new Set(variables.ids);
      }

      // Optimistically update paginated view
      if (previousPaginated) {
        queryClient.setQueryData(['items', 'paginated', statusFilter, page, pageSize], (old: any) => {
          if (!old) return old;
          const newRows = old.rows.filter((row: Item) => !archivedIdsSet.has(row.id));
          return {
            ...old,
            rows: newRows,
            total: Math.max(0, old.total - archivedIdsSet.size),
          };
        });
      }

      // Optimistically update all matching view
      if (previousAll) {
        queryClient.setQueryData(['items', 'all', statusFilter], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            rows: old.rows.filter((row: Item) => !archivedIdsSet.has(row.id)),
            total: Math.max(0, old.total - archivedIdsSet.size),
          };
        });
      }

      return { previousPaginated, previousAll };
    },
    onError: (err, variables, context) => {
      if (context?.previousPaginated) {
        queryClient.setQueryData(['items', 'paginated', statusFilter, page, pageSize], context.previousPaginated);
      }
      if (context?.previousAll) {
        queryClient.setQueryData(['items', 'all', statusFilter], context.previousAll);
      }
    },
    onSuccess: () => {
      // Clear selection on success
      handleClearSelection();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const handleBulkArchive = () => {
    if (isAllMatchingSelected && excludedIds.size === 0) {
      archiveMutation.mutate({ mode: 'all', status: statusFilter });
    } else if (isAllMatchingSelected && excludedIds.size > 0) {
      const allMatchingIds = allItemsData?.rows.map((r) => r.id) ?? [];
      const selectedIdsList = allMatchingIds.filter((id) => !excludedIds.has(id));
      archiveMutation.mutate({ mode: 'selected', ids: selectedIdsList });
    } else {
      archiveMutation.mutate({ mode: 'selected', ids: Array.from(selectedIds) });
    }
  };

  // TanStack Table columns
  const columnHelper = createColumnHelper<Item>();
  const columns = React.useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            data-testid="select-page-checkbox"
            checked={isPageAllSelected}
            ref={(el) => {
              if (el) {
                el.indeterminate = isPageIndeterminate;
              }
            }}
            onChange={handleSelectPageToggle}
          />
        ),
        cell: ({ row }) => {
          const id = row.original.id;
          const isSelected = isRowSelected(id);
          return (
            <input
              type="checkbox"
              data-testid={`row-checkbox-${id}`}
              checked={isSelected}
              onChange={() => handleRowSelectToggle(id)}
            />
          );
        },
      }),
      columnHelper.accessor('id', {
        header: 'ID',
        cell: (info) => info.getValue(),
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
        cell: (info) => info.getValue(),
      }),
    ],
    [isPageAllSelected, isPageIndeterminate, isRowSelected, currentRows]
  );

  const table = useReactTable({
    data: currentRows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  const lastPage = Math.max(1, Math.ceil(totalMatchingCount / pageSize));

  const handlePrevPage = () => {
    setPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setPage((prev) => Math.min(lastPage, prev + 1));
  };

  return (
    <div className="container">
      <h1>Items Admin Console</h1>

      {/* Filter Tabs */}
      <div className="filters">
        <button
          data-testid="filter-active"
          className={`filter-btn ${statusFilter === 'active' ? 'active' : ''}`}
          onClick={() => handleFilterChange('active')}
        >
          Active
        </button>
        <button
          data-testid="filter-archived"
          className={`filter-btn ${statusFilter === 'archived' ? 'active' : ''}`}
          onClick={() => handleFilterChange('archived')}
        >
          Archived
        </button>
      </div>

      {/* Actions and Summary Bar */}
      <div className="actions-bar">
        <div className="selection-info">
          <div>
            Selected: <strong data-testid="selection-count">{selectionCount}</strong>
          </div>
          <div>
            Total Matching: <strong data-testid="total-count">{totalMatchingCount}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            data-testid="clear-selection"
            className="btn btn-secondary"
            onClick={handleClearSelection}
            disabled={selectionCount === 0}
          >
            Clear Selection
          </button>
          <button
            data-testid="bulk-archive"
            className="btn btn-danger"
            onClick={handleBulkArchive}
            disabled={selectionCount === 0 || archiveMutation.isPending}
          >
            Archive Selected
          </button>
        </div>
      </div>

      {/* Select All Matching Banner */}
      {isPageAllSelected && (
        <div className="select-all-banner">
          <span>
            {isAllMatchingSelected
              ? `All ${totalMatchingCount} matching items are selected across all pages.`
              : `All ${currentRowsCount} items on this page are selected.`}
          </span>
          <button
            data-testid="select-all-matching"
            className="btn btn-primary"
            onClick={handleSelectAllMatching}
            disabled={isAllMatchingSelected}
          >
            Select all matching
          </button>
        </div>
      )}

      {/* Data Grid / Table */}
      {isPaginatedLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading items...</div>
      ) : currentRowsCount === 0 ? (
        <div data-testid="empty-state" className="empty-state">
          No items found.
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

      {/* Pagination Controls */}
      <div className="pagination">
        <div data-testid="page-indicator">
          Page {page} of {lastPage}
        </div>
        <div className="pagination-controls">
          <button
            data-testid="prev-page"
            className="btn btn-secondary"
            onClick={handlePrevPage}
            disabled={page === 1}
          >
            Previous
          </button>
          <button
            data-testid="next-page"
            className="btn btn-secondary"
            onClick={handleNextPage}
            disabled={page === lastPage}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
