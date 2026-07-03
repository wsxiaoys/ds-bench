import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchFeedPage, type FeedItem } from '../api/feed'

function FeedCard({ item }: { item: FeedItem }) {
  return (
    <article className="feed-card">
      <header className="feed-card__header">
        <span className="feed-card__id">#{item.id}</span>
        <h3 className="feed-card__title">{item.title}</h3>
      </header>
      <p className="feed-card__body">{item.body}</p>
    </article>
  )
}

export default function Feed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  const items: FeedItem[] =
    data?.pages.flatMap((page) => page.items) ?? []

  if (isLoading) {
    return <div className="feed-status">Loading feed…</div>
  }

  if (isError) {
    return (
      <div className="feed-status feed-status--error">
        <p>Failed to load the feed.</p>
        <p className="feed-status__detail">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
        <button className="feed-button" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="feed">
      <ul className="feed__list">
        {items.map((item) => (
          <li key={item.id} className="feed__item">
            <FeedCard item={item} />
          </li>
        ))}
      </ul>

      <div className="feed__footer">
        {hasNextPage ? (
          <button
            className="feed-button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load More'}
          </button>
        ) : (
          <p className="feed__end">You have reached the end of the feed.</p>
        )}
      </div>
    </div>
  )
}