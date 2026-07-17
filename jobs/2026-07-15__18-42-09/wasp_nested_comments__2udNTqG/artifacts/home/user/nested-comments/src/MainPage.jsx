import React from "react";
import { useQuery, getPosts } from "wasp/client/operations";
import "./Main.css";

export const MainPage = () => {
  const { data: posts, isLoading, error } = useQuery(getPosts);

  return (
    <div className="container">
      <main>
        <h1>Nested Comments Demo</h1>
        <p>
          This is the <code>MainPage</code> at route <code>/</code>. Click a post
          to view its threaded comment tree.
        </p>

        {isLoading ? (
          <p>Loading posts…</p>
        ) : error ? (
          <p>Error loading posts: {String(error)}</p>
        ) : posts && posts.length > 0 ? (
          <ul className="post-list">
            {posts.map((p) => (
              <li key={p.id}>
                <a href={`/post/${p.id}`}>{p.title}</a>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No posts yet. Run <code>wasp db seed devSeed</code> to create seed
            data.
          </p>
        )}
      </main>
    </div>
  );
};
