// Mock API for paginated feed data
const allItems = [
  // Page 1 items
  { id: 1, title: 'Item 1', description: 'This is the first item' },
  { id: 2, title: 'Item 2', description: 'This is the second item' },
  { id: 3, title: 'Item 3', description: 'This is the third item' },
  { id: 4, title: 'Item 4', description: 'This is the fourth item' },
  { id: 5, title: 'Item 5', description: 'This is the fifth item' },
  // Page 2 items
  { id: 6, title: 'Item 6', description: 'This is the sixth item' },
  { id: 7, title: 'Item 7', description: 'This is the seventh item' },
  { id: 8, title: 'Item 8', description: 'This is the eighth item' },
  { id: 9, title: 'Item 9', description: 'This is the ninth item' },
  { id: 10, title: 'Item 10', description: 'This is the tenth item' },
];

const PAGE_SIZE = 5;

export async function fetchFeedPage({ pageParam = 0 }) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const start = pageParam * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const items = allItems.slice(start, end);

  const hasMore = end < allItems.length;
  const nextCursor = hasMore ? pageParam + 1 : undefined;

  return {
    items,
    nextCursor,
  };
}