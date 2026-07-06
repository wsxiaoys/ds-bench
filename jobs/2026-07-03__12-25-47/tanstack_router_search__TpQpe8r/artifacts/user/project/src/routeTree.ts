import { rootRoute, searchRoute } from './routes'

export const routeTree = rootRoute.addChildren([searchRoute])
