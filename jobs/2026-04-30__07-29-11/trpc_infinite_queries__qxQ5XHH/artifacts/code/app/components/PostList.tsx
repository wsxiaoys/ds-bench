'use client';

import { trpc } from '../../trpc/client';
import React from 'react';

export function PostList() {
  const [data, query] = trpc.posts.list.useSuspenseInfiniteQuery(
    { limit: 5 },
    {
      initialCursor: 0,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    },
  );

  const posts = data.pages.flatMap((page) => page.items);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = query;

  return (
    <div>
      <h2>Posts</h2>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        Load More
      </button>
    </div>
  );
}
