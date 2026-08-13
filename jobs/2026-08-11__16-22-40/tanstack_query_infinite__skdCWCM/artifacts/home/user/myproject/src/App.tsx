import { useInfiniteQuery } from '@tanstack/react-query'
import './App.css'

interface FeedItem {
  id: number
  title: string
  body: string
  timestamp: string
}

interface FeedPage {
  items: FeedItem[]
  nextCursor: number | null
}

// Generate 30 mock items to support pagination testing
const MOCK_ITEMS: FeedItem[] = Array.from({ length: 30 }, (_, i) => ({
  id: i + 1,
  title: `Feed Item #${i + 1}`,
  body: `This is the body content for feed item number ${i + 1}. It represents a post in our infinite scrolling feed, loaded dynamically using TanStack Query.`,
  timestamp: new Date(Date.now() - i * 3600000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  }),
}))

// Mock API function with artificial delay
const fetchFeed = async ({ pageParam = 0 }: { pageParam: number }): Promise<FeedPage> => {
  // Simulate 500ms network latency
  await new Promise((resolve) => setTimeout(resolve, 500))

  const limit = 5
  const startIndex = pageParam
  const endIndex = startIndex + limit
  const items = MOCK_ITEMS.slice(startIndex, endIndex)
  const nextCursor = endIndex < MOCK_ITEMS.length ? endIndex : null

  return {
    items,
    nextCursor,
  }
}

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
    queryFn: ({ pageParam }) => fetchFeed({ pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  return (
    <div className="feed-container">
      <header className="feed-header">
        <h1>Infinite Scroll Feed</h1>
        <p className="feed-subtitle">Powered by TanStack Query</p>
      </header>

      <main className="feed-main">
        {status === 'pending' ? (
          <div className="status-message">Loading feed...</div>
        ) : status === 'error' ? (
          <div className="status-message error">
            Error loading feed: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        ) : (
          <div className="feed-list">
            {data.pages.map((page, pageIndex) => (
              <div key={pageIndex} className="feed-page">
                {page.items.map((item) => (
                  <article key={item.id} className="feed-card">
                    <div className="feed-card-header">
                      <span className="feed-card-author">User {item.id}</span>
                      <span className="feed-card-time">{item.timestamp}</span>
                    </div>
                    <h2 className="feed-card-title">{item.title}</h2>
                    <p className="feed-card-body">{item.body}</p>
                  </article>
                ))}
              </div>
            ))}

            <div className="feed-actions">
              {isFetchingNextPage && (
                <div className="status-message">Loading more items...</div>
              )}

              <button
                type="button"
                className="load-more-btn"
                onClick={() => fetchNextPage()}
                disabled={!hasNextPage || isFetchingNextPage}
              >
                Load More
              </button>

              {!hasNextPage && (
                <p className="no-more-items">You have reached the end of the feed.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
