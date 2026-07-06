'use client';

import { trpc } from '../../trpc/client';
import React from 'react';

export function PostList() {
  const [data, query] = trpc.posts.list.useSuspenseInfiniteQuery(
    { limit: 2 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      initialCursor: 0,
    }
  );

  return (
    <div>
      <h2>Posts</h2>
      <ul>
        {data.pages.map((page) =>
          page.items.map((post) => (
            <li key={post.id}>{post.title}</li>
          ))
        )}
      </ul>
      <button
        disabled={!query.hasNextPage || query.isFetchingNextPage}
        onClick={() => query.fetchNextPage()}
      >
        Load More
      </button>
    </div>
  );
}