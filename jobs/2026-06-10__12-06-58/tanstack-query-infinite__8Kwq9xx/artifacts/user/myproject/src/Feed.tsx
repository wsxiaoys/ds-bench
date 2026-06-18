import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchFeedPage } from './mockApi';

export default function Feed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  if (status === 'pending') {
    return <p className="loading">Loading feed…</p>;
  }

  if (status === 'error') {
    return <p className="error">Failed to load feed.</p>;
  }

  return (
    <div className="feed">
      <h1>Infinite Scrolling Feed</h1>

      <ul className="feed-list">
        {data.pages.map((page) =>
          page.items.map((item) => (
            <li key={item.id} className="feed-item">
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              <span className="page-badge">Page {item.page}</span>
            </li>
          ))
        )}
      </ul>

      <div className="load-more-container">
        {hasNextPage ? (
          <button
            className="load-more-btn"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load More'}
          </button>
        ) : (
          <p className="end-message">You've reached the end of the feed.</p>
        )}
      </div>
    </div>
  );
}
