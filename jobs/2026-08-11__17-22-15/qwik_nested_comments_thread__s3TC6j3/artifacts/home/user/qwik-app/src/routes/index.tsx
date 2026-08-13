import { component$ } from '@builder.io/qwik';
import { routeLoader$, routeAction$, zod$, Form } from '@builder.io/qwik-city';
import { getCommentTree, getDb, type Comment } from '../db.server';

export const useCommentTree = routeLoader$(async () => {
  return getCommentTree();
});

export const useAddComment = routeAction$(
  async (data, { fail }) => {
    const db = getDb();
    let parentId: number | null = null;

    if (data.parentId && data.parentId.trim() !== '') {
      const pId = parseInt(data.parentId, 10);
      if (isNaN(pId)) {
        return fail(400, { message: 'Invalid parent ID' });
      }

      // Check if parent comment exists
      const parent = db.prepare('SELECT id FROM comments WHERE id = ?').get(pId);
      if (!parent) {
        return fail(400, { message: 'Parent comment does not exist' });
      }
      parentId = pId;
    }

    try {
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO comments (parent_id, author, body, created_at)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(parentId, data.author, data.body, now);
      return { success: true };
    } catch (err: any) {
      return fail(500, { message: err.message || 'Database error' });
    }
  },
  zod$((z) => z.object({
    parentId: z.string().optional(),
    author: z.string().min(2, { message: 'Author must be at least 2 characters long' }),
    body: z.string().min(1, { message: 'Comment body cannot be empty' }),
  }))
);

interface CommentNodeProps {
  comment: Comment;
  action: any;
}

export const CommentNode = component$<CommentNodeProps>(({ comment, action }) => {
  return (
    <div
      data-testid="comment"
      data-comment-id={String(comment.id)}
      data-parent-id={comment.parent_id !== null ? String(comment.parent_id) : ''}
      data-depth={String(comment.depth)}
      class="comment-node"
      style={{
        marginLeft: `${comment.depth > 0 ? 20 : 0}px`,
        borderLeft: comment.depth > 0 ? '2px solid #eaeaea' : 'none',
        paddingLeft: comment.depth > 0 ? '15px' : '0px',
        marginTop: '15px',
        paddingBottom: '10px',
      }}
    >
      <div class="comment-content">
        <span class="comment-author" style={{ fontWeight: 'bold' }}>{comment.author}</span>
        <span class="comment-date" style={{ color: '#888', fontSize: '0.85em', marginLeft: '10px' }}>
          {new Date(comment.created_at).toLocaleString()}
        </span>
        <p class="comment-body" style={{ margin: '5px 0' }}>{comment.body}</p>
      </div>

      <Form action={action} data-testid="reply-form" data-parent-id={String(comment.id)} style={{ marginTop: '10px' }}>
        <input type="hidden" name="parentId" value={String(comment.id)} />
        <div style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
          <input
            type="text"
            name="author"
            placeholder="Your name"
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
            required
          />
          <input
            type="text"
            name="body"
            placeholder="Write a reply..."
            style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
            required
          />
          <button
            type="submit"
            style={{
              padding: '4px 12px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reply
          </button>
        </div>
      </Form>

      {comment.children && comment.children.length > 0 && (
        <div class="comment-children">
          {comment.children.map((child) => (
            <CommentNode key={child.id} comment={child} action={action} />
          ))}
        </div>
      )}
    </div>
  );
});

export default component$(() => {
  const comments = useCommentTree();
  const action = useAddComment();

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Threaded Comments</h1>

      {action.value?.failed && (
        <div
          data-testid="error"
          style={{
            color: '#d32f2f',
            backgroundColor: '#fde8e8',
            padding: '10px 15px',
            borderRadius: '4px',
            marginBottom: '20px',
            border: '1px solid #f8b4b4',
          }}
        >
          {action.value.message || 'Validation failed. Author must be at least 2 characters and comment must not be empty.'}
        </div>
      )}

      {/* New Root Comment Form */}
      <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '30px', border: '1px solid #eee' }}>
        <h3>Post a new comment</h3>
        <Form action={action} data-testid="reply-form" data-parent-id="">
          <input type="hidden" name="parentId" value="" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input
              type="text"
              name="author"
              placeholder="Your name"
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', maxWidth: '300px' }}
              required
            />
            <textarea
              name="body"
              placeholder="Write a comment..."
              rows={3}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%', resize: 'vertical' }}
              required
            ></textarea>
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                alignSelf: 'flex-start',
              }}
            >
              Post Comment
            </button>
          </div>
        </Form>
      </div>

      {/* Render comment tree */}
      <div class="comments-list">
        {comments.value.map((comment) => (
          <CommentNode key={comment.id} comment={comment} action={action} />
        ))}
      </div>
    </div>
  );
});
