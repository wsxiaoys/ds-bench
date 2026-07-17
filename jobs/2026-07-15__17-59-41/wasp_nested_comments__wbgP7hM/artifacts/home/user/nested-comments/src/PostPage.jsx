import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useAction, getCommentTree, createComment, deleteComment } from 'wasp/client/operations'
import './Main.css'

// Recursively renders a single comment node and its children.
function CommentNode({ comment, onDelete }) {
  return (
    <li className="comment-node" style={{ listStyle: 'none' }}>
      <div className="comment-box" style={{ border: '1px solid #ccc', padding: '8px', margin: '4px 0', borderRadius: '4px' }}>
        <div className="comment-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>{comment.authorUsername}</strong>
          <button
            onClick={() => onDelete(comment.id)}
            style={{ cursor: 'pointer', background: 'none', border: 'none', color: '#d33', fontSize: '0.85em' }}
            title="Delete this comment and all replies"
          >
            delete
          </button>
        </div>
        <p className="comment-content" style={{ margin: '4px 0' }}>{comment.content}</p>
      </div>
      {comment.children && comment.children.length > 0 && (
        <ul style={{ margin: '0 0 0 20px', padding: 0 }}>
          {comment.children.map((child) => (
            <CommentNode key={child.id} comment={child} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </li>
  )
}

export const PostPage = () => {
  const { postId: postIdParam } = useParams()
  const postId = Number(postIdParam)

  const { data: commentTree, isLoading, error } = useQuery(getCommentTree, { postId })
  const createCommentFn = useAction(createComment)
  const deleteCommentFn = useAction(deleteComment)

  const [content, setContent] = useState('')
  const [authorUsername, setAuthorUsername] = useState('alice')
  const [replyingTo, setReplyingTo] = useState(null) // parentId or null
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    try {
      await createCommentFn({
        postId,
        authorUsername,
        content: content.trim(),
        parentId: replyingTo,
      })
      setContent('')
      setReplyingTo(null)
    } catch (err) {
      console.error('Failed to create comment:', err)
      alert('Failed to create comment: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId) => {
    if (!confirm('Delete this comment and all of its replies?')) return
    try {
      await deleteCommentFn({ commentId })
    } catch (err) {
      console.error('Failed to delete comment:', err)
      alert('Failed to delete comment: ' + err.message)
    }
  }

  if (isNaN(postId)) {
    return <div className="container"><p>Invalid post ID.</p></div>
  }

  return (
    <div className="container">
      <main style={{ maxWidth: '700px', margin: '0 auto' }}>
        <h2>Post #{postId} — Comments</h2>

        {/* Form to create a new comment (top-level or reply) */}
        <form onSubmit={handleSubmit} style={{ marginBottom: '20px', padding: '12px', border: '1px solid #ddd', borderRadius: '6px' }}>
          <div style={{ marginBottom: '8px' }}>
            <label style={{ marginRight: '8px' }}>Author:</label>
            <select value={authorUsername} onChange={(e) => setAuthorUsername(e.target.value)}>
              <option value="alice">alice</option>
              <option value="bob">bob</option>
            </select>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={replyingTo ? `Replying to comment #${replyingTo}...` : 'Write a comment...'}
              style={{ width: '100%', minHeight: '60px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="submit" disabled={submitting || !content.trim()} className="button button-filled" style={{ fontSize: '0.9em' }}>
              {submitting ? 'Posting...' : replyingTo ? 'Post Reply' : 'Post Comment'}
            </button>
            {replyingTo && (
              <button
                type="button"
                onClick={() => { setReplyingTo(null); setContent('') }}
                style={{ fontSize: '0.85em', cursor: 'pointer' }}
              >
                Cancel reply
              </button>
            )}
          </div>
        </form>

        {/* Comment tree */}
        {isLoading && <p>Loading comments...</p>}
        {error && <p style={{ color: 'red' }}>Error loading comments: {error.message}</p>}
        {!isLoading && !error && (
          commentTree && commentTree.length > 0 ? (
            <ul style={{ padding: 0, margin: 0 }}>
              {commentTree.map((comment) => (
                <CommentNode key={comment.id} comment={comment} onDelete={handleDelete} />
              ))}
            </ul>
          ) : (
            <p>No comments yet. Be the first to comment!</p>
          )
        )}
      </main>
    </div>
  )
}