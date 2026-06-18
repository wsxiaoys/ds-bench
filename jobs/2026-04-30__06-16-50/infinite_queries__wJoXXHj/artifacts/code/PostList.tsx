'use client';

import { trpc } from '../../trpc/client';
import React from 'react';

export function PostList() {
  const [data, queryResult] = trpc.posts.list.useSuspenseInfiniteQuery(
    { limit: 5 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  );

  // Flatten all pages' items into a single array
  const posts = data.pages.flatMap((page) => page.items);

  return (
    <div>
      <h2>Posts</h2>
      <ul className="list-disc pl-5">
        {posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
      <div className="mt-4">
        <button
          onClick={() => queryResult.fetchNextPage()}
          disabled={!queryResult.hasNextPage || queryResult.isFetchingNextPage}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {queryResult.isFetchingNextPage ? 'Loading more...' : 'Load More'}
        </button>
      </div>
    </div>
  );
}
