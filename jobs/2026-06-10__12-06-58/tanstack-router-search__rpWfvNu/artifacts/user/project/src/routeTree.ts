import { createRootRoute, createRoute } from '@tanstack/react-router'
import { RootComponent } from './routes/root'
import { SearchComponent, searchValidateSearch } from './routes/search'

const rootRoute = createRootRoute({
  component: RootComponent,
})

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: SearchComponent,
  validateSearch: searchValidateSearch,
})

export const routeTree = rootRoute.addChildren([searchRoute])
