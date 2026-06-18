'use client';

import { trpc } from '../../trpc/client';
import React from 'react';

export function PostList() {
  const [result] = trpc.posts.list.useSuspenseInfiniteQuery(
    {
      limit: 5,
    },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = result;

  const allPosts = data.pages.flatMap((page) => page.items);

  return (
    <div>
      <h2>Posts</h2>
      <ul>
        {allPosts.map((post) => (
          <li key={post.id}>{post.title}</li>
        ))}
      </ul>
      <button
        onClick={() => fetchNextPage()}
        disabled={!hasNextPage || isFetchingNextPage}
      >
        Load More
      </button>
    </div>
  );
}