import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { bulkArchive, fetchItems } from "./api";
import type { Item, ItemsResponse, Status } from "./types";

const PAGE_SIZE = 10;

type Selection =
  | { mode: "partial"; ids: Set<number> }
  | { mode: "all"; status: Status };

function emptySelection(): Selection {
  return { mode: "partial", ids: new Set<number>() };
}

const columnHelper = createColumnHelper<Item>();

export default function App() {
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Status>("active");
  const [page, setPage] = useState(1);
  const [selection, setSelection] = useState<Selection>(emptySelection());

  const queryKey = ["items", filter, page, PAGE_SIZE] as const;

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchItems(filter, page, PAGE_SIZE),
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = data?.rows ?? [];
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);

  // Keep the current page within bounds if the total shrinks (e.g. after archiving).
  useEffect(() => {
    if (data && page > lastPage) {
      setPage(lastPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function isSelected(id: number): boolean {
    if (selection.mode === "all") return true;
    return selection.ids.has(id);
  }

  const selectionCount = selection.mode === "all" ? total : selection.ids.size;
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => isSelected(id));

  async function fetchAllIds(status: Status, count: number): Promise<number[]> {
    if (count <= 0) return [];
    const resp = await fetchItems(status, 1, count);
    return resp.rows.map((r) => r.id);
  }

  function handleFilterChange(next: Status) {
    if (next === filter) return;
    setFilter(next);
    setPage(1);
    setSelection(emptySelection());
  }

  function togglePageCheckbox(checked: boolean) {
    if (checked) {
      setSelection((prev) => {
        if (prev.mode === "all") return prev;
        const next = new Set(prev.ids);
        pageIds.forEach((id) => next.add(id));
        return { mode: "partial", ids: next };
      });
      return;
    }

    if (selection.mode === "all") {
      fetchAllIds(filter, total).then((allIds) => {
        const next = new Set(allIds);
        pageIds.forEach((id) => next.delete(id));
        setSelection({ mode: "partial", ids: next });
      });
      return;
    }

    setSelection((prev) => {
      if (prev.mode === "all") return prev;
      const next = new Set(prev.ids);
      pageIds.forEach((id) => next.delete(id));
      return { mode: "partial", ids: next };
    });
  }

  function toggleRow(id: number, checked: boolean) {
    if (selection.mode === "all") {
      if (checked) return; // already selected
      fetchAllIds(filter, total).then((allIds) => {
        const next = new Set(allIds);
        next.delete(id);
        setSelection({ mode: "partial", ids: next });
      });
      return;
    }

    setSelection((prev) => {
      if (prev.mode === "all") return prev;
      const next = new Set(prev.ids);
      if (checked) next.add(id);
      else next.delete(id);
      return { mode: "partial", ids: next };
    });
  }

  function selectAllMatching() {
    setSelection({ mode: "all", status: filter });
  }

  function clearSelection() {
    setSelection(emptySelection());
  }

  const bulkArchiveMutation = useMutation({
    mutationFn: async () => {
      if (selection.mode === "all") {
        return bulkArchive({ mode: "all", status: selection.status });
      }
      return bulkArchive({ mode: "selected", ids: Array.from(selection.ids) });
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["items"] });
      const previous = queryClient.getQueriesData<ItemsResponse>({
        queryKey: ["items"],
      });

      const snapshot = selection;
      queryClient.setQueriesData<ItemsResponse>(
        { queryKey: ["items"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            rows: old.rows.map((row) => {
              const matches =
                snapshot.mode === "all"
                  ? row.status === snapshot.status
                  : snapshot.ids.has(row.id);
              return matches ? { ...row, status: "archived" as const } : row;
            }),
          };
        },
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        for (const [key, prevData] of context.previous) {
          queryClient.setQueryData(key, prevData);
        }
      }
    },
    onSuccess: () => {
      setSelection(emptySelection());
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "select",
        header: () => (
          <input
            type="checkbox"
            data-testid="select-page-checkbox"
            checked={allPageSelected}
            onChange={(e) => togglePageCheckbox(e.target.checked)}
          />
        ),
        cell: (info) => {
          const id = info.row.original.id;
          return (
            <input
              type="checkbox"
              data-testid={`row-checkbox-${id}`}
              checked={isSelected(id)}
              onChange={(e) => toggleRow(id, e.target.checked)}
            />
          );
        },
      }),
      columnHelper.accessor("id", { header: "ID" }),
      columnHelper.accessor("name", { header: "Name" }),
      columnHelper.accessor("category", { header: "Category" }),
      columnHelper.accessor("status", { header: "Status" }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allPageSelected, pageIds, selection, filter],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: lastPage,
  });

  return (
    <div className="app">
      <h1>Items</h1>

      <div className="toolbar">
        <div className="filters" role="group" aria-label="Status filter">
          <button
            type="button"
            data-testid="filter-active"
            className={filter === "active" ? "active" : ""}
            onClick={() => handleFilterChange("active")}
          >
            Active
          </button>
          <button
            type="button"
            data-testid="filter-archived"
            className={filter === "archived" ? "active" : ""}
            onClick={() => handleFilterChange("archived")}
          >
            Archived
          </button>
        </div>

        <div className="summary">
          <span>
            Total: <strong data-testid="total-count">{total}</strong>
          </span>
          <span>
            Selected: <strong data-testid="selection-count">{selectionCount}</strong>
          </span>
        </div>
      </div>

      <div className="actions">
        <button
          type="button"
          data-testid="select-all-matching"
          disabled={!allPageSelected}
          onClick={selectAllMatching}
        >
          Select all matching ({total})
        </button>
        <button type="button" data-testid="clear-selection" onClick={clearSelection}>
          Clear selection
        </button>
        <button
          type="button"
          data-testid="bulk-archive"
          disabled={selectionCount === 0 || bulkArchiveMutation.isPending}
          onClick={() => bulkArchiveMutation.mutate()}
        >
          Archive selected
        </button>
      </div>

      {isLoading && !data ? (
        <p>Loading…</p>
      ) : isError ? (
        <p>Failed to load items.</p>
      ) : rows.length === 0 ? (
        <div data-testid="empty-state">No items found.</div>
      ) : (
        <table className="items-table">
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

      <div className="pagination">
        <button
          type="button"
          data-testid="prev-page"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span data-testid="page-indicator">
          Page {page} of {lastPage}
        </span>
        <button
          type="button"
          data-testid="next-page"
          disabled={page >= lastPage}
          onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
