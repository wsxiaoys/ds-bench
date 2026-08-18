import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, getPosts, getCommentTree, createComment, deleteComment } from 'wasp/client/operations'

const CommentNodeComponent = ({ comment, postId, onReplyCreated, onDeleteComment }) => {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [replyAuthor, setReplyAuthor] = useState('alice')
  const [replyContent, setReplyContent] = useState('')

  const handleReplySubmit = async (e) => {
    e.preventDefault()
    if (!replyContent.trim()) return
    try {
      await onReplyCreated({
        postId,
        authorUsername: replyAuthor,
        content: replyContent,
        parentId: comment.id,
      })
      setReplyContent('')
      setShowReplyForm(false)
    } catch (err) {
      alert(err.message || 'Failed to reply')
    }
  }

  return (
    <div style={{
      marginLeft: '20px',
      borderLeft: '2px solid #ccc',
      paddingLeft: '15px',
      marginTop: '10px',
      marginBottom: '10px'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '0.9rem', color: '#555', fontWeight: 'bold' }}>
          {comment.authorUsername}
        </div>
        <div style={{ fontSize: '1.05rem', color: '#111', whiteSpace: 'pre-wrap' }}>
          {comment.content}
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button
            onClick={() => setShowReplyForm(!showReplyForm)}
            style={{
              background: 'none',
              border: 'none',
              color: '#0066cc',
              cursor: 'pointer',
              fontSize: '0.85rem',
              padding: 0,
              textDecoration: 'underline'
            }}
          >
            {showReplyForm ? 'Cancel' : 'Reply'}
          </button>
          <button
            onClick={() => onDeleteComment(comment.id)}
            style={{
              background: 'none',
              border: 'none',
              color: '#cc0000',
              cursor: 'pointer',
              fontSize: '0.85rem',
              padding: 0,
              textDecoration: 'underline'
            }}
          >
            Delete
          </button>
        </div>
      </div>

      {showReplyForm && (
        <form onSubmit={handleReplySubmit} style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '400px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem' }}>Author:</label>
            <select
              value={replyAuthor}
              onChange={(e) => setReplyAuthor(e.target.value)}
              style={{ padding: '2px 4px', fontSize: '0.85rem' }}
            >
              <option value="alice">alice</option>
              <option value="bob">bob</option>
            </select>
          </div>
          <textarea
            rows="2"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            style={{ width: '100%', padding: '6px', fontSize: '0.9rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button
            type="submit"
            style={{
              alignSelf: 'flex-start',
              padding: '4px 10px',
              fontSize: '0.85rem',
              backgroundColor: '#0066cc',
              color: '#fff',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Submit Reply
          </button>
        </form>
      )}

      {comment.children && comment.children.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          {comment.children.map((child) => (
            <CommentNodeComponent
              key={child.id}
              comment={child}
              postId={postId}
              onReplyCreated={onReplyCreated}
              onDeleteComment={onDeleteComment}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const PostPage = () => {
  const { postId } = useParams()
  const parsedPostId = parseInt(postId, 10)

  const { data: posts } = useQuery(getPosts)
  const { data: commentTree, isLoading, error } = useQuery(getCommentTree, { postId: parsedPostId })

  const [newCommentAuthor, setNewCommentAuthor] = useState('alice')
  const [newCommentContent, setNewCommentContent] = useState('')

  const post = posts?.find((p) => p.id === parsedPostId)

  const handleCreateComment = async (commentData) => {
    await createComment(commentData)
  }

  const handleDeleteComment = async (commentId) => {
    if (confirm('Are you sure you want to delete this comment and all of its replies?')) {
      await deleteComment({ commentId })
    }
  }

  const handleTopLevelSubmit = async (e) => {
    e.preventDefault()
    if (!newCommentContent.trim()) return
    try {
      await handleCreateComment({
        postId: parsedPostId,
        authorUsername: newCommentAuthor,
        content: newCommentContent,
      })
      setNewCommentContent('')
    } catch (err) {
      alert(err.message || 'Failed to create comment')
    }
  }

  if (isLoading) return <div style={{ padding: '20px' }}>Loading comments...</div>
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error loading comments: {error.message}</div>

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <Link to="/" style={{ color: '#0066cc', textDecoration: 'none', display: 'inline-block', marginBottom: '20px' }}>
        &larr; Back to Posts
      </Link>

      {post ? (
        <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>{post.title}</h1>
      ) : (
        <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>Post #{postId}</h1>
      )}

      <section style={{ marginBottom: '40px' }}>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Add a Comment</h3>
        <form onSubmit={handleTopLevelSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label style={{ fontWeight: 'bold' }}>Comment as:</label>
            <select
              value={newCommentAuthor}
              onChange={(e) => setNewCommentAuthor(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '1rem' }}
            >
              <option value="alice">alice</option>
              <option value="bob">bob</option>
            </select>
          </div>
          <textarea
            rows="4"
            value={newCommentContent}
            onChange={(e) => setNewCommentContent(e.target.value)}
            placeholder="What are your thoughts?"
            style={{ width: '100%', padding: '10px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button
            type="submit"
            style={{
              alignSelf: 'flex-start',
              padding: '8px 16px',
              fontSize: '1rem',
              backgroundColor: '#0066cc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Add Comment
          </button>
        </form>
      </section>

      <section>
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>Discussion</h3>
        {commentTree && commentTree.length > 0 ? (
          <div>
            {commentTree.map((comment) => (
              <CommentNodeComponent
                key={comment.id}
                comment={comment}
                postId={parsedPostId}
                onReplyCreated={handleCreateComment}
                onDeleteComment={handleDeleteComment}
              />
            ))}
          </div>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No comments yet. Be the first to comment!</p>
        )}
      </section>
    </div>
  )
}
