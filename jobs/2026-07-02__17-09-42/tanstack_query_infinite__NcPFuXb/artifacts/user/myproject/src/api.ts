/**
 * Mock API for the feed.
 *
 * In a real application this would be an HTTP request. For this demo we
 * simulate latency and use a cursor-based pagination scheme so the feed
 * can be exercised with `useInfiniteQuery`.
 */

export interface FeedItem {
  id: number
  title: string
  body: string
  author: string
}

export interface FeedPage {
  items: FeedItem[]
  nextCursor: number | null
}

const PAGE_SIZE = 5
const TOTAL_ITEMS = 25

const AUTHORS = [
  'Ada Lovelace',
  'Grace Hopper',
  'Alan Turing',
  'Margaret Hamilton',
  'Linus Torvalds',
]

const buildItem = (id: number): FeedItem => ({
  id,
  title: `Post #${id}: Thoughts on server state`,
  body: `This is post number ${id}. It illustrates a single page entry returned by the mock feed API.`,
  author: AUTHORS[id % AUTHORS.length],
})

const generateAllItems = (): FeedItem[] =>
  Array.from({ length: TOTAL_ITEMS }, (_, index) => buildItem(index + 1))

const ALL_ITEMS = generateAllItems()

/**
 * Fetch a single page of feed items.
 *
 * @param cursor - The id of the last item from the previous page, or `null`
 *                 when requesting the first page.
 */
export const fetchFeedPage = async (
  cursor: number | null,
): Promise<FeedPage> => {
  // Simulate network latency so the loading state is visible.
  await new Promise((resolve) => setTimeout(resolve, 400))

  const startIndex = cursor === null ? 0 : cursor
  const endIndex = startIndex + PAGE_SIZE
  const items = ALL_ITEMS.slice(startIndex, endIndex)
  const nextCursor = endIndex < ALL_ITEMS.length ? endIndex : null

  return { items, nextCursor }
}
