import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, getCommentTree, createComment, deleteComment } from "wasp/client/operations";

const CommentNode = ({ comment, onReply, onDelete }) => {
  const [isReplying, setIsReplying] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [author, setAuthor] = useState("alice");

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    try {
      await onReply(comment.id, author, replyContent);
      setReplyContent("");
      setIsReplying(false);
    } catch (err) {
      alert("Error replying: " + err.message);
    }
  };

  return (
    <div style={{ marginLeft: '20px', borderLeft: '2px solid #ddd', paddingLeft: '15px', marginTop: '10px' }}>
      <div style={{ backgroundColor: '#fcfcfc', padding: '10px', borderRadius: '5px', border: '1px solid #eee' }}>
        <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>
          <strong>{comment.authorUsername}</strong>
        </p>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
          {comment.content}
        </p>
        <div style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
          <button 
            onClick={() => setIsReplying(!isReplying)} 
            style={{ background: 'none', border: 'none', color: '#ff5e00', cursor: 'pointer', padding: 0 }}
          >
            Reply
          </button>
          <button 
            onClick={() => onDelete(comment.id)} 
            style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', padding: 0 }}
          >
            Delete
          </button>
        </div>
      </div>

      {isReplying && (
        <form onSubmit={handleReplySubmit} style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select value={author} onChange={(e) => setAuthor(e.target.value)} style={{ padding: '5px' }}>
            <option value="alice">alice</option>
            <option value="bob">bob</option>
          </select>
          <input
            type="text"
            placeholder="Write a reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            style={{ flexGrow: 1, padding: '5px' }}
          />
          <button type="submit" style={{ padding: '5px 10px', backgroundColor: '#ff5e00', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
            Submit
          </button>
          <button type="button" onClick={() => setIsReplying(false)} style={{ padding: '5px 10px', backgroundColor: '#ccc', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
            Cancel
          </button>
        </form>
      )}

      {comment.children && comment.children.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          {comment.children.map((child) => (
            <CommentNode 
              key={child.id} 
              comment={child} 
              onReply={onReply} 
              onDelete={onDelete} 
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const PostPage = () => {
  const { postId } = useParams();
  const id = parseInt(postId, 10);

  const { data: commentTree, isLoading, error, refetch } = useQuery(getCommentTree, { postId: id });

  const [newCommentContent, setNewCommentContent] = useState("");
  const [newCommentAuthor, setNewCommentAuthor] = useState("alice");

  const handleCreateTopLevelComment = async (e) => {
    e.preventDefault();
    if (!newCommentContent.trim()) return;
    try {
      await createComment({
        postId: id,
        authorUsername: newCommentAuthor,
        content: newCommentContent,
        parentId: null,
      });
      setNewCommentContent("");
      refetch();
    } catch (err) {
      alert("Error creating comment: " + err.message);
    }
  };

  const handleReply = async (parentId, authorUsername, content) => {
    await createComment({
      postId: id,
      authorUsername,
      content,
      parentId,
    });
    refetch();
  };

  const handleDelete = async (commentId) => {
    if (confirm("Are you sure you want to delete this comment and all its replies?")) {
      try {
        await deleteComment({ commentId });
        refetch();
      } catch (err) {
        alert("Error deleting comment: " + err.message);
      }
    }
  };

  if (isLoading) return <div style={{ padding: '20px' }}>Loading comments...</div>;
  if (error) return <div style={{ padding: '20px' }}>Error loading comments: {error.message}</div>;

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <Link to="/" style={{ color: '#ff5e00', textDecoration: 'none', fontWeight: 'bold' }}>&larr; Back to Posts</Link>
      
      <h2 style={{ marginTop: '20px' }}>Post Comments</h2>

      <form onSubmit={handleCreateTopLevelComment} style={{ margin: '20px 0', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        <h3>Add a Comment</h3>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
          <label>Author:</label>
          <select value={newCommentAuthor} onChange={(e) => setNewCommentAuthor(e.target.value)} style={{ padding: '5px' }}>
            <option value="alice">alice</option>
            <option value="bob">bob</option>
          </select>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <textarea
            placeholder="What are your thoughts?"
            value={newCommentContent}
            onChange={(e) => setNewCommentContent(e.target.value)}
            style={{ flexGrow: 1, padding: '10px', minHeight: '60px' }}
          />
          <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#ff5e00', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontWeight: 'bold' }}>
            Comment
          </button>
        </div>
      </form>

      <div style={{ marginTop: '30px' }}>
        {commentTree && commentTree.length > 0 ? (
          commentTree.map((comment) => (
            <CommentNode 
              key={comment.id} 
              comment={comment} 
              onReply={handleReply} 
              onDelete={handleDelete} 
            />
          ))
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No comments yet. Be the first to comment!</p>
        )}
      </div>
    </div>
  );
};
