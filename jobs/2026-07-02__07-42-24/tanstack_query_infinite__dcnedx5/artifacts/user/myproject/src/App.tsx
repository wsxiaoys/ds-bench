import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchFeed, type FeedItem } from './api'
import './App.css'

function App() {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isPending,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeed(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Infinite Scroll Feed</h1>
        <p className="subtitle">Powered by TanStack Query & Vite</p>
      </header>

      <main className="feed-container">
        {isPending ? (
          <div className="loading-state">Loading feed...</div>
        ) : status === 'error' ? (
          <div className="error-state">Error loading feed: {(error as Error).message}</div>
        ) : (
          <>
            <div className="feed-list">
              {data.pages.map((page) =>
                page.items.map((item: FeedItem) => (
                  <article key={item.id} className="feed-card">
                    <div className="card-header">
                      <span className="card-id">{item.id}</span>
                      <span className="card-time">{item.timestamp}</span>
                    </div>
                    <h2 className="card-title">{item.title}</h2>
                    <p className="card-content">{item.content}</p>
                  </article>
                ))
              )}
            </div>

            <div className="feed-actions">
              {isFetchingNextPage && <div className="loading-more-indicator">Loading more items...</div>}
              {hasNextPage ? (
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="load-more-btn"
                >
                  Load More
                </button>
              ) : (
                <p className="no-more-items">You have reached the end of the feed.</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App
