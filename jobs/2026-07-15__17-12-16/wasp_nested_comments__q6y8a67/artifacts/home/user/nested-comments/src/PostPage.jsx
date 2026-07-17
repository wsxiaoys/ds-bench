import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, getCommentTree, getPosts, createComment, deleteComment } from 'wasp/client/operations'

const CommentNodeComponent = ({ 
  node, 
  onReply, 
  onDelete, 
  activeUser, 
  replyingToId, 
  setReplyingToId, 
  replyContent, 
  setReplyContent 
}) => {
  const isReplying = replyingToId === node.id;

  return (
    <div style={{ marginLeft: '20px', borderLeft: '2px solid #ccc', paddingLeft: '10px', marginTop: '10px' }} className="comment-node">
      <div style={{ fontWeight: 'bold' }}>
        {node.authorUsername} <span style={{ fontWeight: 'normal', color: '#666', fontSize: '0.85em' }}>(ID: {node.id})</span>
      </div>
      <div style={{ margin: '5px 0' }}>{node.content}</div>
      <div style={{ display: 'flex', gap: '10px', fontSize: '0.9em' }}>
        <button 
          onClick={() => {
            if (isReplying) {
              setReplyingToId(null);
            } else {
              setReplyingToId(node.id);
              setReplyContent('');
            }
          }}
          style={{ background: 'none', border: 'none', color: '#0066cc', cursor: 'pointer', padding: 0 }}
        >
          {isReplying ? 'Cancel' : 'Reply'}
        </button>
        <button 
          onClick={() => onDelete(node.id)}
          style={{ background: 'none', border: 'none', color: '#cc0000', cursor: 'pointer', padding: 0 }}
        >
          Delete
        </button>
      </div>

      {isReplying && (
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            onReply(node.id);
          }}
          style={{ marginTop: '5px', display: 'flex', gap: '5px' }}
        >
          <input 
            type="text" 
            value={replyContent} 
            onChange={(e) => setReplyContent(e.target.value)} 
            placeholder={`Reply to ${node.authorUsername}...`}
            required
            style={{ padding: '4px 8px', width: '200px' }}
          />
          <button type="submit" style={{ padding: '4px 8px' }}>Send</button>
        </form>
      )}

      {node.children && node.children.length > 0 && (
        <div className="comment-children">
          {node.children.map(child => (
            <CommentNodeComponent 
              key={child.id} 
              node={child} 
              onReply={onReply} 
              onDelete={onDelete}
              activeUser={activeUser}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const PostPage = () => {
  const { postId: postIdStr } = useParams()
  const postId = parseInt(postIdStr, 10)

  const { data: posts, isLoading: isPostsLoading } = useQuery(getPosts)
  const { data: commentTree, isLoading: isCommentsLoading, error: commentsError } = useQuery(getCommentTree, { postId })

  const [activeUser, setActiveUser] = useState('alice')
  const [newCommentContent, setNewCommentContent] = useState('')
  const [replyingToId, setReplyingToId] = useState(null)
  const [replyContent, setReplyContent] = useState('')

  if (isNaN(postId)) {
    return <div style={{ padding: '20px' }}>Invalid Post ID</div>
  }

  if (isPostsLoading || isCommentsLoading) {
    return <div style={{ padding: '20px' }}>Loading...</div>
  }

  const post = posts?.find(p => p.id === postId)
  if (!post) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Post not found</h2>
        <Link to="/">Back to Home</Link>
      </div>
    )
  }

  const handleCreateComment = async (e) => {
    e.preventDefault()
    if (!newCommentContent.trim()) return
    try {
      await createComment({
        postId,
        authorUsername: activeUser,
        content: newCommentContent,
        parentId: null
      })
      setNewCommentContent('')
    } catch (err) {
      alert('Failed to create comment: ' + err.message)
    }
  }

  const handleReply = async (parentId) => {
    if (!replyContent.trim()) return
    try {
      await createComment({
        postId,
        authorUsername: activeUser,
        content: replyContent,
        parentId
      })
      setReplyingToId(null)
      setReplyContent('')
    } catch (err) {
      alert('Failed to reply: ' + err.message)
    }
  }

  const handleDelete = async (commentId) => {
    if (window.confirm('Are you sure you want to delete this comment and all its replies?')) {
      try {
        await deleteComment({ commentId })
      } catch (err) {
        alert('Failed to delete comment: ' + err.message)
      }
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <Link to="/" style={{ display: 'inline-block', marginBottom: '20px' }}>&larr; Back to Posts</Link>
      
      <h1>{post.title}</h1>
      <div style={{ borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '20px' }}>
        <label style={{ marginRight: '10px', fontWeight: 'bold' }}>
          Posting as:
          <select 
            value={activeUser} 
            onChange={(e) => setActiveUser(e.target.value)}
            style={{ marginLeft: '5px', padding: '4px 8px' }}
          >
            <option value="alice">alice</option>
            <option value="bob">bob</option>
          </select>
        </label>
      </div>

      <h2>Comments</h2>
      
      <div className="comments-list" style={{ marginBottom: '30px' }}>
        {commentTree && commentTree.length > 0 ? (
          commentTree.map(node => (
            <CommentNodeComponent 
              key={node.id} 
              node={node} 
              onReply={handleReply} 
              onDelete={handleDelete}
              activeUser={activeUser}
              replyingToId={replyingToId}
              setReplyingToId={setReplyingToId}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
            />
          ))
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No comments yet. Be the first to comment!</p>
        )}
      </div>

      <div style={{ background: '#f9f9f9', padding: '20px', borderRadius: '5px' }}>
        <h3>Add a Comment</h3>
        <form onSubmit={handleCreateComment}>
          <textarea 
            value={newCommentContent} 
            onChange={(e) => setNewCommentContent(e.target.value)} 
            placeholder="Write a comment..."
            required
            rows={4}
            style={{ width: '100%', padding: '10px', boxSizing: 'border-box', marginBottom: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '8px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Submit Comment
          </button>
        </form>
      </div>
    </div>
  )
}
