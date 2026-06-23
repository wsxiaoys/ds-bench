import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchFeedPage } from "./mockApi";

function Feed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
  } = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam = 0 }) => fetchFeedPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  if (status === "pending") {
    return <p className="status-message">Loading feed...</p>;
  }

  if (status === "error") {
    return <p className="status-message error">Error: {error.message}</p>;
  }

  return (
    <div className="feed">
      <h1>Article Feed</h1>
      <ul className="feed-list">
        {data.pages.map((page) =>
          page.items.map((item) => (
            <li key={item.id} className="feed-item">
              <h2 className="feed-item-title">{item.title}</h2>
              <span className="feed-item-author">By {item.author}</span>
              <p className="feed-item-excerpt">{item.excerpt}</p>
            </li>
          ))
        )}
      </ul>
      <div className="feed-actions">
        {hasNextPage ? (
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="load-more-btn"
          >
            {isFetchingNextPage ? "Loading..." : "Load More"}
          </button>
        ) : (
          <p className="status-message">You have reached the end of the feed.</p>
        )}
      </div>
    </div>
  );
}

export default Feed;
