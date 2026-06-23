export interface FeedItem {
  id: number;
  title: string;
  description: string;
}

export interface FeedResponse {
  items: FeedItem[];
  nextCursor: number | null;
}

const ALL_ITEMS: FeedItem[] = Array.from({ length: 25 }, (_, i) => ({
  id: i + 1,
  title: `Feed Item ${i + 1}`,
  description: `This is the description for feed item ${i + 1}. It contains interesting content.`,
}));

export const fetchFeed = async (cursor: number = 0, limit: number = 5): Promise<FeedResponse> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const startIndex = cursor;
  const endIndex = startIndex + limit;
  const items = ALL_ITEMS.slice(startIndex, endIndex);
  const nextCursor = endIndex < ALL_ITEMS.length ? endIndex : null;

  return {
    items,
    nextCursor,
  };
};
