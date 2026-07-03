import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchFeedPage, type FeedItem } from './api'
import './Feed.css'

type FeedPage = Awaited<ReturnType<typeof fetchFeedPage>>

export const Feed = () => {
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery<FeedPage, Error>({
    queryKey: ['feed'],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam as number | null),
    initialPageParam: null as number | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })

  if (status === 'pending') {
    return <div className="feed-status">Loading feed…</div>
  }

  if (status === 'error') {
    return (
      <div className="feed-status feed-status--error">
        Error loading feed: {error.message}
      </div>
    )
  }

  const items: FeedItem[] = data?.pages.flatMap((page) => page.items) ?? []

  return (
    <div className="feed">
      <header className="feed__header">
        <h1>Infinite Feed</h1>
        <p>
          {items.length} item{items.length === 1 ? '' : 's'} loaded
          {hasNextPage ? ' — click below to fetch the next page.' : ' — end of feed.'}
        </p>
      </header>

      <ul className="feed__list">
        {items.map((item) => (
          <li key={item.id} className="feed__item">
            <h2 className="feed__item-title">{item.title}</h2>
            <p className="feed__item-body">{item.body}</p>
            <span className="feed__item-author">— {item.author}</span>
          </li>
        ))}
      </ul>

      <div className="feed__actions">
        <button
          type="button"
          className="feed__load-more"
          onClick={() => fetchNextPage()}
          disabled={!hasNextPage || isFetchingNextPage}
        >
          {isFetchingNextPage
            ? 'Loading…'
            : hasNextPage
              ? 'Load More'
              : 'No more items'}
        </button>

        {isFetching && !isFetchingNextPage ? (
          <span className="feed__refetching">Refreshing…</span>
        ) : null}
      </div>
    </div>
  )
}
