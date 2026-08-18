import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchFeedData } from './api'
import './App.css'

function App() {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeedData(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  return (
    <div className="feed-container">
      <header className="feed-header">
        <h1>TanStack Query Infinite Scrolling Feed</h1>
        <p>Demonstrating pagination and server state management with React and TanStack Query.</p>
      </header>

      <main className="feed-main">
        {status === 'pending' ? (
          <div className="status-message">Loading initial feed...</div>
        ) : status === 'error' ? (
          <div className="status-message error">
            Error loading feed: {(error as Error).message}
          </div>
        ) : (
          <>
            <ul className="feed-list">
              {data.pages.map((page, pageIdx) => (
                <div key={pageIdx} className="page-group">
                  {page.items.map((item) => (
                    <li key={item.id} className="feed-item">
                      <span className="item-id">#{item.id}</span>
                      <h3 className="item-title">{item.title}</h3>
                      <p className="item-body">{item.body}</p>
                    </li>
                  ))}
                </div>
              ))}
            </ul>

            <div className="feed-actions">
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
                <p className="no-more-items">No more items to load</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App
