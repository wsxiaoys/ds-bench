import React, { Suspense } from 'react';
import { PostList } from './components/PostList';

export default function Page() {
  return (
    <main>
      <h1>Infinite Queries Task</h1>
      <Suspense fallback={<div>Loading posts...</div>}>
        <PostList />
      </Suspense>
    </main>
  );
}
