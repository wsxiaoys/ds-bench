import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, getCommentTree, createComment, deleteComment } from "wasp/client/operations";

function ReplyForm({ postId, parentId, onDone }) {
  const [username, setUsername] = useState("alice");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createComment({
        postId,
        authorUsername: username,
        content,
        parentId: parentId ?? null,
      });
      setContent("");
      onDone();
    } catch (err) {
      setError(err.message || "Failed to create comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ margin: "8px 0" }}>
      <select value={username} onChange={(e) => setUsername(e.target.value)}>
        <option value="alice">alice</option>
        <option value="bob">bob</option>
      </select>{" "}
      <input
        type="text"
        placeholder={parentId ? "Write a reply..." : "Write a comment..."}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{ width: 300 }}
      />{" "}
      <button type="submit" disabled={submitting}>
        {parentId ? "Reply" : "Comment"}
      </button>
      {error && <div style={{ color: "red" }}>{error}</div>}
    </form>
  );
}

function CommentNode({ postId, node, onChanged }) {
  const [replying, setReplying] = useState(false);

  const handleDelete = async () => {
    await deleteComment({ commentId: node.id });
    onChanged();
  };

  return (
    <div style={{ marginLeft: 20, borderLeft: "1px solid #ddd", paddingLeft: 12, marginTop: 8 }}>
      <div>
        <strong>{node.authorUsername}</strong>: <span data-testid="comment-content">{node.content}</span>{" "}
        <button onClick={() => setReplying((r) => !r)}>Reply</button>{" "}
        <button onClick={handleDelete}>Delete</button>
      </div>
      {replying && (
        <ReplyForm
          postId={postId}
          parentId={node.id}
          onDone={() => {
            setReplying(false);
            onChanged();
          }}
        />
      )}
      {node.children.map((child) => (
        <CommentNode key={child.id} postId={postId} node={child} onChanged={onChanged} />
      ))}
    </div>
  );
}

export const PostPage = () => {
  const { postId } = useParams();
  const numericPostId = Number(postId);

  const {
    data: commentTree,
    isLoading,
    error,
    refetch,
  } = useQuery(getCommentTree, { postId: numericPostId });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="container">
      <h2>Comments for post #{postId}</h2>

      <ReplyForm postId={numericPostId} parentId={null} onDone={refetch} />

      <div>
        {(commentTree ?? []).map((node) => (
          <CommentNode key={node.id} postId={numericPostId} node={node} onChanged={refetch} />
        ))}
      </div>
    </div>
  );
};
