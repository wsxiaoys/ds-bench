import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchFeed } from './api/feed'
import type { FeedItem } from './api/feed'
import './App.css'

function App() {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isPending,
    isError,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam = 0 }) => fetchFeed(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>TanStack Query Infinite Scroll Feed</h1>
        <p>A demonstration of cursor-based pagination and server state management.</p>
      </header>

      <main className="feed-container">
        {isPending ? (
          <div className="status-message">Loading initial items...</div>
        ) : isError ? (
          <div className="status-message error">
            Error: {error instanceof Error ? error.message : 'Failed to fetch feed'}
          </div>
        ) : (
          <>
            <div className="feed-list" role="list">
              {data.pages.map((page, pageIndex) => (
                <div key={pageIndex} className="page-group">
                  {page.items.map((item: FeedItem) => (
                    <div key={item.id} className="feed-item" role="listitem">
                      <span className="item-id">#{item.id}</span>
                      <h3 className="item-title">{item.title}</h3>
                      <p className="item-description">{item.description}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="actions-container">
              {hasNextPage ? (
                <button
                  type="button"
                  className="load-more-btn"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  Load More
                </button>
              ) : (
                <p className="no-more-message">You have reached the end of the feed.</p>
              )}
            </div>

            {isFetchingNextPage && (
              <div className="fetching-indicator">Fetching next page...</div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
