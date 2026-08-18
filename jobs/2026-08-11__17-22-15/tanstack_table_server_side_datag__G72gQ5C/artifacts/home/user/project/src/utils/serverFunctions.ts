import { createServerFn } from '@tanstack/react-start'
import { strictQuerySchema } from '../schemas'
import { queryEmployees } from './employees'

export const getEmployeesFn = createServerFn({ method: 'GET' })
  .validator((params: unknown) => {
    // Validate and parse the input using strictQuerySchema
    return strictQuerySchema.parse(params)
  })
  .handler(async ({ data }) => {
    return queryEmployees(data)
  })
