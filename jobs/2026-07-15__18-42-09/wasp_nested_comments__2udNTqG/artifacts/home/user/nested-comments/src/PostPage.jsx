import React from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "wasp/client/operations";
import { getCommentTree } from "wasp/client/operations";

/**
 * Recursive component that renders a comment and all of its
 * descendants, indented to reflect the depth in the tree.
 */
function CommentNode({ node, depth }) {
  const indent = { marginLeft: `${depth * 20}px` };
  return (
    <div className="comment-node" style={indent}>
      <div className="comment-bubble">
        <span className="comment-author">
          {node.authorUsername ?? "anonymous"}
        </span>
        <span className="comment-content">{node.content}</span>
      </div>
      {node.children && node.children.length > 0 ? (
        <div className="comment-children">
          {node.children.map((child) => (
            <CommentNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const PostPage = () => {
  const { postId: postIdParam } = useParams();
  const postId = Number.parseInt(postIdParam, 10);

  const { data, error, isLoading } = useQuery(getCommentTree, { postId });

  if (Number.isNaN(postId)) {
    return (
      <div className="container">
        <h1>Invalid post id</h1>
        <p>
          The URL <code>/post/{postIdParam}</code> does not contain a valid
          numeric post id.
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="post-header">
        <a href="/" className="back-link">
          ← All posts
        </a>
        <h1>Post #{postId}</h1>
      </header>

      {isLoading ? (
        <p>Loading comments…</p>
      ) : error ? (
        <p>Error loading comments: {String(error)}</p>
      ) : data && data.length > 0 ? (
        <div className="comment-tree">
          {data.map((node) => (
            <CommentNode key={node.id} node={node} depth={0} />
          ))}
        </div>
      ) : (
        <p>No comments yet.</p>
      )}
    </div>
  );
};
