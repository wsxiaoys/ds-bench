'use client';

import { trpc } from '../../trpc/client';
import React from 'react';

export function PostList() {
  const [data, { fetchNextPage, hasNextPage, isFetchingNextPage }] = trpc.posts.list.useSuspenseInfiniteQuery(
    { limit: 5 },
    {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  return (
    <div>
      <h2>Posts</h2>
      <ul>
        {data.pages.map((page, i) => (
          <React.Fragment key={i}>
            {page.items.map((post) => (
              <li key={post.id}>{post.title}</li>
            ))}
          </React.Fragment>
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
