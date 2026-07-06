export interface FeedItem {
  id: number
  title: string
  body: string
}

export interface FeedPage {
  items: FeedItem[]
  nextCursor: number | null
}

// Simulated latency for the mock API
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Total number of items in our feed
const TOTAL_ITEMS = 25
const PAGE_SIZE = 5

export async function fetchFeedPage(cursor: number = 0): Promise<FeedPage> {
  await delay(300)

  const start = cursor
  const end = Math.min(start + PAGE_SIZE, TOTAL_ITEMS)
  const items: FeedItem[] = []

  for (let i = start; i < end; i++) {
    items.push({
      id: i + 1,
      title: `Post #${i + 1}`,
      body: `This is the body of post number ${i + 1}. It's an interesting piece of content.`,
    })
  }

  const nextCursor = end < TOTAL_ITEMS ? end : null

  return {
    items,
    nextCursor,
  }
}
