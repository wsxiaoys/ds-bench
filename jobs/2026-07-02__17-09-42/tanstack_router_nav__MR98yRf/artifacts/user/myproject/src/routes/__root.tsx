import { Outlet, createRootRoute } from '@tanstack/react-router'
import Navigation from '../Navigation'
import '../index.css'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <Navigation />
      <hr />
      <Outlet />
    </>
  )
}
