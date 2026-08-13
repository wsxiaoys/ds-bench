import { z } from 'zod'

const allowedFields = ['id', 'name', 'email', 'department', 'salary'] as const
const allowedDirections = ['asc', 'desc'] as const

export const strictQuerySchema = z.object({
  q: z.string().default(''),
  sort: z.string().default('id:asc').refine((val) => {
    if (!val) return true
    const tokens = val.split(',')
    return tokens.every((token) => {
      const parts = token.split(':')
      if (parts.length !== 2) return false
      const [field, dir] = parts
      return allowedFields.includes(field as any) && allowedDirections.includes(dir as any)
    })
  }, {
    message: "Invalid sort parameter format. Must be comma-separated 'field:direction' tokens, where field is id/name/email/department/salary and direction is asc/desc."
  }),
  page: z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10)
      return isNaN(parsed) ? val : parsed
    }
    return val
  }, z.number().int().min(1).default(1)),
  pageSize: z.preprocess((val) => {
    if (val === undefined || val === null || val === '') return undefined
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10)
      return isNaN(parsed) ? val : parsed
    }
    return val
  }, z.number().int().min(1).max(100).default(8))
})

export type QueryParams = z.infer<typeof strictQuerySchema>
