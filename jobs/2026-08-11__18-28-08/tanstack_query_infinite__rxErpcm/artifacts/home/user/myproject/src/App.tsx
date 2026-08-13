import { QueryClient, QueryClientProvider, useInfiniteQuery } from '@tanstack/react-query';
import './App.css';

// Create a client
const queryClient = new QueryClient();

interface FeedItem {
  id: number;
  title: string;
  description: string;
}

interface FeedResponse {
  items: FeedItem[];
  nextCursor: number | null;
}

// Mock API function
export const fetchFeed = async (cursor: number = 0): Promise<FeedResponse> => {
  // Simulate network latency
  await new Promise((resolve) => setTimeout(resolve, 600));

  const itemsPerPage = 5;
  const totalItems = 25; // 5 pages of data
  
  const items: FeedItem[] = [];
  const start = cursor * itemsPerPage;
  const end = Math.min(start + itemsPerPage, totalItems);

  for (let i = start; i < end; i++) {
    items.push({
      id: i + 1,
      title: `Feed Item #${i + 1}`,
      description: `This is the description for feed item #${i + 1}. It is loaded dynamically using TanStack Query infinite query.`,
    });
  }

  const nextCursor = end < totalItems ? cursor + 1 : null;

  return {
    items,
    nextCursor,
  };
};

function Feed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeed(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  return (
    <div className="feed-container">
      <header className="feed-header">
        <h1>TanStack Query Infinite Feed</h1>
        <p className="subtitle">Demonstrating pagination and server state management</p>
      </header>

      {status === 'pending' ? (
        <div className="loading">Loading initial feed...</div>
      ) : status === 'error' ? (
        <div className="error">Error loading feed: {(error as Error).message}</div>
      ) : (
        <>
          <ul className="feed-list">
            {data?.pages.flatMap((page) => page.items).map((item) => (
              <li key={item.id} className="feed-item">
                <div className="feed-item-badge">Item {item.id}</div>
                <h3 className="feed-item-title">{item.title}</h3>
                <p className="feed-item-desc">{item.description}</p>
              </li>
            ))}
          </ul>

          <div className="feed-actions">
            <button
              onClick={() => fetchNextPage()}
              disabled={!hasNextPage || isFetchingNextPage}
              className="load-more-btn"
            >
              Load More
            </button>
          </div>

          <div className="feed-status">
            {isFetchingNextPage ? 'Loading more...' : isFetching ? 'Background updating...' : null}
          </div>
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Feed />
    </QueryClientProvider>
  );
}
