import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { NavigationMenu } from '../components/NavigationMenu'

export const Route = createRootRouteWithContext()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div className="app-shell">
      <NavigationMenu />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}