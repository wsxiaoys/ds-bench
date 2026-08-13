import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, getCommentTree, getPosts, createComment, deleteComment } from 'wasp/client/operations';

export const PostPage = () => {
  const { postId } = useParams();
  const numericPostId = parseInt(postId || '', 10);

  const { data: posts } = useQuery(getPosts);
  const { data: commentTree, isLoading, error } = useQuery(getCommentTree, { postId: numericPostId });

  const [authorUsername, setAuthorUsername] = useState('alice');
  const [newCommentContent, setNewCommentContent] = useState('');
  const [replyingToId, setReplyingToId] = useState(null);
  const [replyContent, setReplyContent] = useState('');

  const currentPost = posts?.find(p => p.id === numericPostId);

  const handleCreateComment = async (e) => {
    e.preventDefault();
    if (!newCommentContent.trim()) return;
    try {
      await createComment({
        postId: numericPostId,
        authorUsername,
        content: newCommentContent,
        parentId: null
      });
      setNewCommentContent('');
    } catch (err) {
      alert(err.message || 'Failed to create comment');
    }
  };

  const handleCreateReply = async (e, parentId) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    try {
      await createComment({
        postId: numericPostId,
        authorUsername,
        content: replyContent,
        parentId
      });
      setReplyContent('');
      setReplyingToId(null);
    } catch (err) {
      alert(err.message || 'Failed to create reply');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment and all its replies?')) return;
    try {
      await deleteComment({ commentId });
    } catch (err) {
      alert(err.message || 'Failed to delete comment');
    }
  };

  if (isLoading) return <div className="loading" style={{ textAlign: 'center', padding: '50px' }}>Loading comments...</div>;
  if (error) return <div className="error" style={{ textAlign: 'center', padding: '50px', color: 'red' }}>Error: {error.message || error}</div>;

  const renderComment = (node) => {
    return (
      <div key={node.id} className="comment-node" style={{ marginLeft: '20px', borderLeft: '2px solid #ccc', paddingLeft: '10px', marginTop: '10px' }}>
        <div className="comment-header">
          <strong>{node.authorUsername}</strong> <span className="comment-id" style={{ fontSize: '0.8em', color: '#666' }}>(ID: {node.id})</span>
        </div>
        <div className="comment-content" style={{ marginTop: '5px', whiteSpace: 'pre-wrap' }}>{node.content}</div>
        <div className="comment-actions" style={{ marginTop: '5px' }}>
          <button className="btn-small" onClick={() => {
            setReplyingToId(node.id);
            setReplyContent('');
          }} style={{ padding: '2px 8px', fontSize: '0.8em', cursor: 'pointer' }}>Reply</button>
          <button className="btn-small btn-danger" onClick={() => handleDeleteComment(node.id)} style={{ marginLeft: '10px', padding: '2px 8px', fontSize: '0.8em', cursor: 'pointer', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '3px' }}>Delete</button>
        </div>

        {replyingToId === node.id && (
          <form onSubmit={(e) => handleCreateReply(e, node.id)} style={{ marginTop: '10px' }}>
            <input 
              type="text" 
              placeholder="Write a reply..." 
              value={replyContent} 
              onChange={(e) => setReplyContent(e.target.value)}
              style={{ padding: '5px', width: '70%', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <button type="submit" className="btn-small" style={{ marginLeft: '5px', padding: '5px 10px', cursor: 'pointer' }}>Submit</button>
            <button type="button" className="btn-small" onClick={() => setReplyingToId(null)} style={{ marginLeft: '5px', padding: '5px 10px', cursor: 'pointer' }}>Cancel</button>
          </form>
        )}

        {node.children && node.children.length > 0 && (
          <div className="comment-children">
            {node.children.map(child => renderComment(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="post-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <Link to="/" style={{ textDecoration: 'none', color: '#4f46e5', fontWeight: 'bold' }}>&larr; Back to Posts</Link>
      <h1 style={{ marginTop: '15px', color: '#111827' }}>{currentPost ? currentPost.title : `Post #${numericPostId}`}</h1>

      <div className="author-select" style={{ marginBottom: '20px', background: '#f3f4f6', padding: '10px', borderRadius: '5px' }}>
        <label>
          Posting as: 
          <select value={authorUsername} onChange={(e) => setAuthorUsername(e.target.value)} style={{ marginLeft: '10px', padding: '5px', borderRadius: '4px', border: '1px solid #ccc' }}>
            <option value="alice">alice</option>
            <option value="bob">bob</option>
          </select>
        </label>
      </div>

      <div className="comments-section">
        <h3 style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>Comments</h3>
        {commentTree && commentTree.length > 0 ? (
          commentTree.map(node => renderComment(node))
        ) : (
          <p style={{ color: '#6b7280' }}>No comments yet. Be the first to comment!</p>
        )}
      </div>

      <div className="new-comment-form" style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
        <h3>Add a Comment</h3>
        <form onSubmit={handleCreateComment}>
          <textarea
            placeholder="Write a comment..."
            value={newCommentContent}
            onChange={(e) => setNewCommentContent(e.target.value)}
            style={{ width: '100%', height: '80px', padding: '10px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" className="btn" style={{ marginTop: '10px', padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Submit Comment
          </button>
        </form>
      </div>
    </div>
  );
};
