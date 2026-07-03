import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Feed from './components/Feed'
import './App.css'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="app">
        <header className="app__header">
          <h1>Infinite Scrolling Feed</h1>
          <p>Powered by TanStack Query</p>
        </header>
        <main className="app__main">
          <Feed />
        </main>
      </div>
    </QueryClientProvider>
  )
}

export default App