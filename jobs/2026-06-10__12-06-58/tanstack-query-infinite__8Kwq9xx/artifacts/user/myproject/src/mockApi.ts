export interface FeedItem {
  id: number;
  title: string;
  body: string;
  page: number;
}

export interface FeedPage {
  items: FeedItem[];
  nextCursor: number | null;
}

const PAGE_SIZE = 5;

const allItems: FeedItem[] = [
  // Page 1 items
  { id: 1,  title: 'Post #1',  body: 'This is the content of post 1.',  page: 1 },
  { id: 2,  title: 'Post #2',  body: 'This is the content of post 2.',  page: 1 },
  { id: 3,  title: 'Post #3',  body: 'This is the content of post 3.',  page: 1 },
  { id: 4,  title: 'Post #4',  body: 'This is the content of post 4.',  page: 1 },
  { id: 5,  title: 'Post #5',  body: 'This is the content of post 5.',  page: 1 },
  // Page 2 items
  { id: 6,  title: 'Post #6',  body: 'This is the content of post 6.',  page: 2 },
  { id: 7,  title: 'Post #7',  body: 'This is the content of post 7.',  page: 2 },
  { id: 8,  title: 'Post #8',  body: 'This is the content of post 8.',  page: 2 },
  { id: 9,  title: 'Post #9',  body: 'This is the content of post 9.',  page: 2 },
  { id: 10, title: 'Post #10', body: 'This is the content of post 10.', page: 2 },
  // Page 3 items
  { id: 11, title: 'Post #11', body: 'This is the content of post 11.', page: 3 },
  { id: 12, title: 'Post #12', body: 'This is the content of post 12.', page: 3 },
  { id: 13, title: 'Post #13', body: 'This is the content of post 13.', page: 3 },
  { id: 14, title: 'Post #14', body: 'This is the content of post 14.', page: 3 },
  { id: 15, title: 'Post #15', body: 'This is the content of post 15.', page: 3 },
];

export async function fetchFeedPage(cursor: number = 1): Promise<FeedPage> {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  const start = (cursor - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const items = allItems.slice(start, end);
  const nextCursor = end < allItems.length ? cursor + 1 : null;

  return { items, nextCursor };
}
