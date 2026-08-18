import { db } from '../db'
import { QueryParams } from '../schemas'

export interface Employee {
  id: number
  name: string
  email: string
  department: string
  salary: number
}

export interface EmployeesResponse {
  rows: Employee[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export function queryEmployees(params: QueryParams): EmployeesResponse {
  const { q, sort, page, pageSize } = params

  let countSql = 'SELECT COUNT(*) as count FROM employees'
  let selectSql = 'SELECT * FROM employees'
  const queryArgs: any[] = []

  if (q && q.trim() !== '') {
    const filterClause = ' WHERE name LIKE ? OR email LIKE ?'
    countSql += filterClause
    selectSql += filterClause
    const likeVal = `%${q}%`
    queryArgs.push(likeVal, likeVal)
  }

  // Handle sorting
  const sortTokens = sort ? sort.split(',') : []
  const orderByParts: string[] = []
  for (const token of sortTokens) {
    const [field, dir] = token.split(':')
    if (field && dir) {
      orderByParts.push(`"${field}" ${dir.toUpperCase()}`)
    }
  }

  if (orderByParts.length > 0) {
    selectSql += ` ORDER BY ${orderByParts.join(', ')}`
  } else {
    selectSql += ' ORDER BY id ASC'
  }

  // Handle pagination
  const limit = pageSize
  const offset = (page - 1) * pageSize
  selectSql += ' LIMIT ? OFFSET ?'

  // Execute count query
  const countStmt = db.prepare(countSql)
  const countResult = countStmt.get(...queryArgs) as { count: number }
  const total = countResult.count

  // Execute select query
  const selectStmt = db.prepare(selectSql)
  const rows = selectStmt.all(...queryArgs, limit, offset) as Employee[]

  const pageCount = Math.max(1, Math.ceil(total / pageSize))

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount
  }
}
