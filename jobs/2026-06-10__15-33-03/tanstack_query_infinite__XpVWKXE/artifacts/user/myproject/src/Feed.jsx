import { useInfiniteQuery } from '@tanstack/react-query';
import { fetchFeedPage } from './api';

function Feed() {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: fetchFeedPage,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  if (isLoading) return <div>Loading feed...</div>;
  if (isError) return <div>Error: {error.message}</div>;

  const items = data.pages.flatMap((page) => page.items);

  return (
    <div>
      <h1>Feed</h1>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.title}</strong> - {item.description}
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading More...' : 'Load More'}
        </button>
      )}
      {!hasNextPage && <p>No more items to load.</p>}
    </div>
  );
}

export default Feed;