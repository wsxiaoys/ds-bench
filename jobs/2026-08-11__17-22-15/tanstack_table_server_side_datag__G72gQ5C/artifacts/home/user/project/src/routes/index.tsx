import { createFileRoute } from '@tanstack/react-router'
import { useReactTable, getCoreRowModel, ColumnDef, flexRender } from '@tanstack/react-table'
import * as React from 'react'
import { useState, useEffect, useMemo } from 'react'
import { strictQuerySchema, QueryParams } from '../schemas'
import { getEmployeesFn } from '../utils/serverFunctions'
import { Employee } from '../utils/employees'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): QueryParams => {
    const result = strictQuerySchema.safeParse(search)
    if (result.success) {
      return result.data
    }
    return {
      q: '',
      sort: 'id:asc',
      page: 1,
      pageSize: 8,
    }
  },
  loaderDeps: ({ search }) => ({
    q: search.q,
    sort: search.sort,
    page: search.page,
    pageSize: search.pageSize,
  }),
  loader: async ({ deps }) => {
    return getEmployeesFn({ data: deps })
  },
  component: IndexComponent,
})

function IndexComponent() {
  const { q, sort, page, pageSize } = Route.useSearch()
  const { rows, total, pageCount } = Route.useLoaderData()
  const navigate = Route.useNavigate()

  const [filterInput, setFilterInput] = useState(q)

  // Sync local input state with URL search param 'q' (handles Back/Forward navigation)
  useEffect(() => {
    setFilterInput(q)
  }, [q])

  const handleSubmitFilter = (e: React.FormEvent) => {
    e.preventDefault()
    navigate({
      search: (prev) => ({
        ...prev,
        q: filterInput,
        page: 1,
      }),
    })
  }

  const handleSort = (field: string) => {
    let newSort = `${field}:asc`
    if (sort === `${field}:asc`) {
      newSort = `${field}:desc`
    }
    navigate({
      search: (prev) => ({
        ...prev,
        sort: newSort,
      }),
    })
  }

  const handleNextPage = () => {
    if (page < pageCount) {
      navigate({
        search: (prev) => ({
          ...prev,
          page: page + 1,
        }),
      })
    }
  }

  const handlePrevPage = () => {
    if (page > 1) {
      navigate({
        search: (prev) => ({
          ...prev,
          page: page - 1,
        }),
      })
    }
  }

  const columns = useMemo<ColumnDef<Employee>[]>(() => [
    {
      accessorKey: 'id',
      header: 'ID',
    },
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ getValue }) => <span data-testid="cell-name">{getValue<string>()}</span>,
    },
    {
      accessorKey: 'email',
      header: 'Email',
    },
    {
      accessorKey: 'department',
      header: 'Department',
    },
    {
      accessorKey: 'salary',
      header: 'Salary',
      cell: ({ getValue }) => {
        const val = getValue<number>()
        return <span>${val.toLocaleString()}</span>
      },
    },
  ], [])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  return (
    <div style={{ padding: '24px', fontFamily: 'system-ui, sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '24px', fontSize: '28px', color: '#111' }}>Employee Data Grid</h1>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <form onSubmit={handleSubmitFilter}>
          <input
            type="text"
            data-testid="global-filter"
            value={filterInput}
            onChange={(e) => setFilterInput(e.target.value)}
            placeholder="Search by name or email... (Press Enter)"
            style={{
              padding: '8px 12px',
              fontSize: '14px',
              width: '320px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              outline: 'none',
            }}
          />
        </form>

        <div style={{ fontSize: '15px', fontWeight: 600, color: '#444' }}>
          Total Employees: <span data-testid="total-count">{total}</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} style={{ borderBottom: '2px solid #e0e0e0', backgroundColor: '#f9f9f9' }}>
                {headerGroup.headers.map((header) => {
                  const field = header.column.id
                  const isSorted = sort.startsWith(`${field}:`)
                  const isDesc = sort.endsWith(':desc')
                  return (
                    <th key={header.id} style={{ padding: '12px 16px', textAlign: 'left' }}>
                      <button
                        data-testid={`sort-${field}`}
                        onClick={() => handleSort(field)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: '14px',
                          fontWeight: 'bold',
                          color: '#333',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: 0,
                        }}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span style={{ fontSize: '12px', color: isSorted ? '#000' : '#aaa' }}>
                          {isSorted ? (isDesc ? '↓' : '↑') : '↕'}
                        </span>
                      </button>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} style={{ borderBottom: '1px solid #e0e0e0', transition: 'background-color 0.2s' }}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ padding: '12px 16px', fontSize: '14px', color: '#555' }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} style={{ padding: '24px', textAlign: 'center', color: '#888' }}>
                  No employees found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '14px', color: '#666' }}>
          Page {page} of {pageCount}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            data-testid="prev-page"
            onClick={handlePrevPage}
            disabled={page <= 1}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
              backgroundColor: page <= 1 ? '#f5f5f5' : '#fff',
              color: page <= 1 ? '#999' : '#333',
              fontWeight: 500,
            }}
          >
            Previous
          </button>
          <button
            data-testid="next-page"
            onClick={handleNextPage}
            disabled={page >= pageCount}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              cursor: page >= pageCount ? 'not-allowed' : 'pointer',
              backgroundColor: page >= pageCount ? '#f5f5f5' : '#fff',
              color: page >= pageCount ? '#999' : '#333',
              fontWeight: 500,
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
