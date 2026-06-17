import { useInfiniteQuery } from '@tanstack/react-query'
import './App.css'

// Mock API function
const fetchPage = async ({ pageParam = 0 }) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500))
  
  const itemsPerPage = 10
  const items = Array.from({ length: itemsPerPage }).map((_, i) => {
    const id = pageParam * itemsPerPage + i
    return {
      id,
      name: `Item ${id + 1}`,
      description: `This is the description for item ${id + 1}.`
    }
  })
  
  // Return items and the next cursor (pageParam + 1). 
  // If we want a limit, we can return undefined for nextCursor after some pages.
  return {
    items,
    nextCursor: pageParam < 4 ? pageParam + 1 : undefined
  }
}

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
    queryFn: fetchPage,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1>Infinite Scrolling Feed</h1>
      
      {status === 'pending' ? (
        <p>Loading...</p>
      ) : status === 'error' ? (
        <p>Error: {error.message}</p>
      ) : (
        <>
          <div className="feed-list">
            {data.pages.map((page, i) => (
              <div key={i}>
                {page.items.map((item) => (
                  <div 
                    key={item.id} 
                    style={{ 
                      padding: '16px', 
                      margin: '8px 0', 
                      border: '1px solid #ccc',
                      borderRadius: '8px'
                    }}
                  >
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              onClick={() => fetchNextPage()}
              disabled={!hasNextPage || isFetchingNextPage}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                cursor: (!hasNextPage || isFetchingNextPage) ? 'not-allowed' : 'pointer'
              }}
            >
              {isFetchingNextPage
                ? 'Loading more...'
                : hasNextPage
                ? 'Load More'
                : 'Nothing more to load'}
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>
            {isFetching && !isFetchingNextPage ? 'Fetching...' : null}
          </div>
        </>
      )}
    </div>
  )
}

export default App
