import {
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router'
import { z } from 'zod'
import { SearchPage } from './search'

export const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

const searchSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
})

export const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: searchSchema,
  component: SearchPage,
})
