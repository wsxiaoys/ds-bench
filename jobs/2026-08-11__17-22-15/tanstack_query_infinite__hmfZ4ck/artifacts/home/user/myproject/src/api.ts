export interface FeedItem {
  id: number;
  title: string;
  body: string;
}

export interface FeedResponse {
  items: FeedItem[];
  nextCursor: number | null;
}

const ALL_ITEMS: FeedItem[] = Array.from({ length: 25 }, (_, idx) => ({
  id: idx + 1,
  title: `Feed Item #${idx + 1}`,
  body: `This is the detailed content for feed item number ${idx + 1}. It contains some placeholder text describing the item.`,
}));

export const fetchFeedData = async (cursor: number = 0, limit: number = 5): Promise<FeedResponse> => {
  // Simulate network latency of 500ms
  await new Promise((resolve) => setTimeout(resolve, 500));

  const startIndex = cursor;
  const endIndex = startIndex + limit;
  const items = ALL_ITEMS.slice(startIndex, endIndex);
  const nextCursor = endIndex < ALL_ITEMS.length ? endIndex : null;

  return {
    items,
    nextCursor,
  };
};
