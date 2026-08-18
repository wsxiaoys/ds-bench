import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, getCommentTree, createComment, deleteComment } from 'wasp/client/operations'
import './Main.css'

export const PostPage = () => {
  const { postId: postIdStr } = useParams()
  const postId = parseInt(postIdStr || '', 10)

  const { data: comments, isLoading, error } = useQuery(getCommentTree, { postId })

  const [author, setAuthor] = useState('alice')
  const [newCommentText, setNewCommentText] = useState('')

  const handleAddTopLevelComment = async (e) => {
    e.preventDefault()
    if (!newCommentText.trim()) return
    try {
      await createComment({
        postId,
        authorUsername: author,
        content: newCommentText,
        parentId: null
      })
      setNewCommentText('')
    } catch (err) {
      alert(err.message || 'Error creating comment')
    }
  }

  if (isNaN(postId)) {
    return (
      <div className="container">
        <h2>Invalid Post ID</h2>
        <Link to="/">Back to Home</Link>
      </div>
    )
  }

  if (isLoading) return <div className="container">Loading comments...</div>
  if (error) return <div className="container">Error: {error.message}</div>

  return (
    <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/" style={{ textDecoration: 'none', color: '#4f46e5', fontWeight: 'bold' }}>← Back to All Posts</Link>
      </div>

      <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>Post Discussion</h1>

      {/* Author Selector */}
      <div style={{ backgroundColor: '#f3f4f6', padding: '15px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <label htmlFor="author-select" style={{ fontWeight: 'bold' }}>Posting as user:</label>
        <select
          id="author-select"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #d1d5db' }}
        >
          <option value="alice">alice</option>
          <option value="bob">bob</option>
        </select>
      </div>

      {/* Top-Level Comment Form */}
      <form onSubmit={handleAddTopLevelComment} style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '10px' }}>Add a Comment</h3>
        <textarea
          rows={3}
          value={newCommentText}
          onChange={(e) => setNewCommentText(e.target.value)}
          placeholder="What are your thoughts?"
          style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '10px' }}
        />
        <button
          type="submit"
          className="button button-filled"
          style={{ border: 'none', cursor: 'pointer' }}
        >
          Post Comment
        </button>
      </form>

      {/* Comment Tree */}
      <div>
        <h3 style={{ marginBottom: '15px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>Discussion Thread</h3>
        {comments && comments.length > 0 ? (
          comments.map((comment) => (
            <CommentNodeComponent
              key={comment.id}
              comment={comment}
              postId={postId}
              currentAuthor={author}
            />
          ))
        ) : (
          <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No comments yet. Be the first to comment!</p>
        )}
      </div>
    </div>
  )
}

const CommentNodeComponent = ({ comment, postId, currentAuthor }) => {
  const [isReplying, setIsReplying] = useState(false)
  const [replyText, setReplyText] = useState('')

  const handleReplySubmit = async (e) => {
    e.preventDefault()
    if (!replyText.trim()) return
    try {
      await createComment({
        postId,
        authorUsername: currentAuthor,
        content: replyText,
        parentId: comment.id
      })
      setReplyText('')
      setIsReplying(false)
    } catch (err) {
      alert(err.message || 'Error creating reply')
    }
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this comment and all its replies?')) {
      try {
        await deleteComment({ commentId: comment.id })
      } catch (err) {
        alert(err.message || 'Error deleting comment')
      }
    }
  }

  return (
    <div style={{
      borderLeft: '2px solid #e5e7eb',
      paddingLeft: '15px',
      marginTop: '15px',
      marginBottom: '15px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        padding: '12px',
        borderRadius: '6px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #f3f4f6'
      }}>
        {/* Comment Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontWeight: 'bold', color: '#111827' }}>@{comment.authorUsername}</span>
          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>ID: {comment.id}</span>
        </div>

        {/* Comment Content */}
        <p style={{ margin: '0 0 10px 0', color: '#374151', whiteSpace: 'pre-wrap' }}>{comment.content}</p>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '15px', fontSize: '0.85rem' }}>
          <button
            onClick={() => setIsReplying(!isReplying)}
            style={{
              background: 'none',
              border: 'none',
              color: '#4f46e5',
              cursor: 'pointer',
              padding: 0,
              fontWeight: '600'
            }}
          >
            {isReplying ? 'Cancel' : 'Reply'}
          </button>
          <button
            onClick={handleDelete}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              padding: 0,
              fontWeight: '600'
            }}
          >
            Delete
          </button>
        </div>

        {/* Inline Reply Form */}
        {isReplying && (
          <form onSubmit={handleReplySubmit} style={{ marginTop: '12px' }}>
            <textarea
              rows={2}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={`Reply to @${comment.authorUsername}...`}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box', marginBottom: '8px' }}
            />
            <button
              type="submit"
              className="button button-filled"
              style={{ padding: '4px 12px', fontSize: '0.85rem', border: 'none', cursor: 'pointer' }}
            >
              Submit Reply
            </button>
          </form>
        )}
      </div>

      {/* Render Nested Children */}
      {comment.children && comment.children.length > 0 && (
        <div style={{ marginLeft: '10px' }}>
          {comment.children.map((child) => (
            <CommentNodeComponent
              key={child.id}
              comment={child}
              postId={postId}
              currentAuthor={currentAuthor}
            />
          ))}
        </div>
      )}
    </div>
  )
}
