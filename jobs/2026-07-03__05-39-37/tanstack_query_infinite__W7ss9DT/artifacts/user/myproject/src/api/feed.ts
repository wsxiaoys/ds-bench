// Mock API that serves paginated feed data.
//
// Each "page" of the feed contains a list of items and a `nextCursor` that
// points to the next page. When `nextCursor` is `null` there are no more
// pages to load.
//
// The data is generated in-memory so we can serve at least two distinct pages
// without needing a real backend.

export type FeedItem = {
  id: number
  title: string
  body: string
}

export type FeedPage = {
  items: FeedItem[]
  nextCursor: number | null
}

// Total number of items the mock API can serve.
const TOTAL_ITEMS = 60
// Number of items returned per page.
const PAGE_SIZE = 10

// Generate the full dataset once so pages are stable across requests.
const ALL_ITEMS: FeedItem[] = Array.from({ length: TOTAL_ITEMS }, (_, i) => ({
  id: i + 1,
  title: `Feed Item #${i + 1}`,
  body: `This is the body content for feed item number ${i + 1}. It contains some example text so the list has meaningful content to render.`,
}))

// Simulate a small amount of network latency so loading states are visible.
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch a single page of the feed.
 *
 * @param cursor - The index to start reading from. When `undefined` the first
 *                 page is returned. A `null` cursor means there is no more
 *                 data available.
 */
export async function fetchFeedPage(cursor?: number | null): Promise<FeedPage> {
  await delay(400)

  const start = cursor ?? 0
  const end = Math.min(start + PAGE_SIZE, TOTAL_ITEMS)

  const items = ALL_ITEMS.slice(start, end)

  const nextCursor = end < TOTAL_ITEMS ? end : null

  return { items, nextCursor }
}