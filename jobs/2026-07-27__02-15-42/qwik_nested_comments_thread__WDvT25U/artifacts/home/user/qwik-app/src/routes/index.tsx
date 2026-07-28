import { component$ } from "@builder.io/qwik";
import { Form, routeAction$, routeLoader$, zod$, z } from "@builder.io/qwik-city";
import { getAllCommentsTree, addComment, type CommentNode } from "../db.server";

// Loader to load the entire comments tree server-side
export const useComments = routeLoader$(async () => {
  return getAllCommentsTree();
});

// Action to handle posting replies or new root comments
export const usePostReply = routeAction$(
  async (data, { fail }) => {
    const parentIdStr = data.parentId?.trim();
    const parentId = parentIdStr ? parseInt(parentIdStr, 10) : null;

    if (parentIdStr && isNaN(parentId!)) {
      return fail(400, {
        message: "Invalid parent ID format",
      });
    }

    try {
      addComment(parentId, data.author, data.body);
      return { success: true };
    } catch (err: any) {
      return fail(400, {
        message: err.message || "Failed to add comment",
      });
    }
  },
  zod$({
    parentId: z.string().optional(),
    author: z.string().min(2, "Author must be at least 2 characters"),
    body: z.string().min(1, "Body must be at least 1 character"),
  })
);

// Recursive component to render a comment and its nested replies
interface CommentProps {
  comment: CommentNode;
  action: any;
}

export const Comment = component$<CommentProps>(({ comment, action }) => {
  return (
    <div
      data-testid="comment"
      data-comment-id={String(comment.id)}
      data-parent-id={comment.parentId !== null ? String(comment.parentId) : ""}
      data-depth={String(comment.depth)}
      style={{
        marginLeft: `${comment.depth * 20}px`,
        borderLeft: "2px solid #e2e8f0",
        paddingLeft: "15px",
        marginTop: "15px",
        marginBottom: "15px",
      }}
    >
      <div style={{ marginBottom: "8px" }}>
        <strong style={{ color: "#2d3748" }}>{comment.author}</strong>
        <span style={{ fontSize: "0.85em", color: "#a0aec0", marginLeft: "10px" }}>
          {new Date(comment.createdAt).toLocaleString()}
        </span>
        <p style={{ margin: "5px 0 10px 0", color: "#4a5568", whiteSpace: "pre-wrap" }}>
          {comment.body}
        </p>
      </div>

      {/* Reply form for this comment */}
      <Form action={action} data-testid="reply-form" data-parent-id={String(comment.id)} style={{ marginBottom: "15px" }}>
        <input type="hidden" name="parentId" value={String(comment.id)} />
        <div style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
          <input
            type="text"
            name="author"
            placeholder="Your name"
            style={{
              padding: "4px 8px",
              border: "1px solid #cbd5e0",
              borderRadius: "4px",
              fontSize: "0.9em",
            }}
          />
          <input
            type="text"
            name="body"
            placeholder="Reply to this comment..."
            style={{
              flexGrow: 1,
              padding: "4px 8px",
              border: "1px solid #cbd5e0",
              borderRadius: "4px",
              fontSize: "0.9em",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "4px 12px",
              backgroundColor: "#4299e1",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.9em",
            }}
          >
            Reply
          </button>
        </div>
      </Form>

      {/* Render children recursively */}
      {comment.children.length > 0 && (
        <div style={{ marginTop: "10px" }}>
          {comment.children.map((child) => (
            <Comment key={child.id} comment={child} action={action} />
          ))}
        </div>
      )}
    </div>
  );
});

export default component$(() => {
  const comments = useComments();
  const action = usePostReply();

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ color: "#1a202c", borderBottom: "2px solid #edf2f7", paddingBottom: "10px" }}>
        Threaded Comments
      </h1>

      {/* Error display */}
      {action.value?.failed && (
        <div
          data-testid="error"
          style={{
            backgroundColor: "#fff5f5",
            color: "#c53030",
            border: "1px solid #feb2b2",
            padding: "12px",
            borderRadius: "6px",
            marginBottom: "20px",
          }}
        >
          {action.value.message ||
            (action.value.fieldErrors?.author
              ? `Author: ${Array.isArray(action.value.fieldErrors.author) ? action.value.fieldErrors.author.join(", ") : action.value.fieldErrors.author}`
              : "") ||
            (action.value.fieldErrors?.body
              ? `Body: ${Array.isArray(action.value.fieldErrors.body) ? action.value.fieldErrors.body.join(", ") : action.value.fieldErrors.body}`
              : "") ||
            "Validation failed. Please check your input."}
        </div>
      )}

      {/* New Root Comment Form */}
      <div style={{ backgroundColor: "#f7fafc", padding: "15px", borderRadius: "6px", marginBottom: "30px" }}>
        <h3 style={{ margin: "0 0 12px 0", color: "#2d3748" }}>Post a New Comment</h3>
        <Form action={action} data-testid="reply-form" data-parent-id="">
          <input type="hidden" name="parentId" value="" />
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              type="text"
              name="author"
              placeholder="Your name"
              style={{
                padding: "8px 12px",
                border: "1px solid #cbd5e0",
                borderRadius: "4px",
                width: "200px",
              }}
            />
            <textarea
              name="body"
              placeholder="Write your comment here..."
              rows={3}
              style={{
                padding: "8px 12px",
                border: "1px solid #cbd5e0",
                borderRadius: "4px",
                resize: "vertical",
              }}
            ></textarea>
            <button
              type="submit"
              style={{
                padding: "8px 16px",
                backgroundColor: "#48bb78",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                alignSelf: "flex-start",
                fontWeight: "bold",
              }}
            >
              Post Comment
            </button>
          </div>
        </Form>
      </div>

      {/* Comments Tree */}
      <div>
        {comments.value.length === 0 ? (
          <p style={{ color: "#718096", fontStyle: "italic" }}>No comments yet.</p>
        ) : (
          comments.value.map((comment) => (
            <Comment key={comment.id} comment={comment} action={action} />
          ))
        )}
      </div>
    </div>
  );
});
