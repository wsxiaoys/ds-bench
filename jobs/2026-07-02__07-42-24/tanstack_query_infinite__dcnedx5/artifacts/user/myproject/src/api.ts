export interface FeedItem {
  id: string;
  title: string;
  content: string;
  timestamp: string;
}

export interface FeedResponse {
  items: FeedItem[];
  nextCursor: number | null;
}

const ALL_ITEMS: FeedItem[] = Array.from({ length: 25 }, (_, i) => ({
  id: `item-${i + 1}`,
  title: `Feed Item #${i + 1}`,
  content: `This is the detailed content for feed item number ${i + 1}. It represents some interesting updates from your network.`,
  timestamp: new Date(Date.now() - i * 3600000).toLocaleString(),
}));

const PAGE_SIZE = 5;

export const fetchFeed = async (cursor: number = 0): Promise<FeedResponse> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  const start = cursor;
  const end = start + PAGE_SIZE;
  const items = ALL_ITEMS.slice(start, end);
  const nextCursor = end < ALL_ITEMS.length ? end : null;

  return {
    items,
    nextCursor,
  };
};
