import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchFeedPage, FeedItem } from './api'

function App() {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam = 0 }) => fetchFeedPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  if (status === 'pending') {
    return <div className="loading">Loading feed...</div>
  }

  if (status === 'error') {
    return <div className="loading">Error: {(error as Error).message}</div>
  }

  return (
    <div className="app">
      <h1>TanStack Query Infinite Feed</h1>
      <div>
        {data.pages.map((page, pageIndex) => (
          <div key={pageIndex}>
            {page.items.map((item: FeedItem) => (
              <div key={item.id} className="feed-item">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div>
        <button
          onClick={() => fetchNextPage()}
          disabled={!hasNextPage || isFetchingNextPage}
        >
          {isFetchingNextPage
            ? 'Loading more...'
            : hasNextPage
            ? 'Load More'
            : 'Nothing more to load'}
        </button>
      </div>
      <div className="loading">{isFetching && !isFetchingNextPage ? 'Fetching...' : null}</div>
    </div>
  )
}

export default App
