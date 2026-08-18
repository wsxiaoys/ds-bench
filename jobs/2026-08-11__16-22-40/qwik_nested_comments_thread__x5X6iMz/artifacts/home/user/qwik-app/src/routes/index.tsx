import { component$ } from "@builder.io/qwik";
import { routeLoader$, routeAction$, zod$, Form, z } from "@builder.io/qwik-city";
import { getAllCommentsTree, addComment, type CommentNode } from "../db";

export const useComments = routeLoader$(() => {
  return getAllCommentsTree();
});

export const useAddComment = routeAction$(
  async (data, { fail }) => {
    const parentIdStr = data.parentId?.trim();
    let parentId: number | null = null;
    if (parentIdStr && parentIdStr !== "") {
      parentId = parseInt(parentIdStr, 10);
      if (isNaN(parentId)) {
        return fail(400, {
          message: "Invalid parent comment ID",
        });
      }
    }

    try {
      addComment(parentId, data.author, data.body);
    } catch (err: any) {
      return fail(400, {
        message: err.message || "Failed to add comment",
      });
    }
  },
  zod$({
    parentId: z.string().optional(),
    author: z.string().min(2, "Author must be at least 2 characters"),
    body: z.string().min(1, "Body cannot be empty"),
  })
);

interface CommentComponentProps {
  comment: CommentNode;
  action: any;
}

export const CommentComponent = component$<CommentComponentProps>(({ comment, action }) => {
  return (
    <div
      data-testid="comment"
      data-comment-id={String(comment.id)}
      data-parent-id={comment.parent_id === null ? "" : String(comment.parent_id)}
      data-depth={String(comment.depth)}
      style={{ marginLeft: `${comment.depth * 20}px`, borderLeft: "1px solid #ccc", paddingLeft: "10px", marginBottom: "10px" }}
    >
      <div class="comment-header">
        <strong>{comment.author}</strong> <span style={{ fontSize: "0.8em", color: "#666" }}>{comment.created_at}</span>
      </div>
      <div class="comment-body" style={{ margin: "5px 0" }}>
        {comment.body}
      </div>

      <Form action={action} data-testid="reply-form" data-parent-id={String(comment.id)} style={{ marginBottom: "10px" }}>
        <input type="hidden" name="parentId" value={String(comment.id)} />
        <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
          <input type="text" name="author" placeholder="Name" style={{ padding: "4px" }} />
          <input type="text" name="body" placeholder="Write a reply..." style={{ padding: "4px", flexGrow: 1 }} />
          <button type="submit" style={{ padding: "4px 8px" }}>Reply</button>
        </div>
      </Form>

      {comment.children.map((child) => (
        <CommentComponent key={child.id} comment={child} action={action} />
      ))}
    </div>
  );
});

export default component$(() => {
  const comments = useComments();
  const action = useAddComment();

  const hasError = action.value?.failed;
  const errorMsg = action.value?.failed
    ? action.value.message || (action.value.fieldErrors 
        ? Object.entries(action.value.fieldErrors)
            .map(([field, errs]) => `${field}: ${Array.isArray(errs) ? errs.join(', ') : String(errs)}`)
            .join('; ')
        : "Validation failed")
    : null;

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Threaded Comments</h1>

      {hasError && (
        <div data-testid="error" style={{ color: "red", backgroundColor: "#ffe6e6", padding: "10px", marginBottom: "15px", borderRadius: "4px" }}>
          {errorMsg}
        </div>
      )}

      <div style={{ marginBottom: "30px" }}>
        <h2>Add a new comment</h2>
        <Form action={action} data-testid="reply-form" data-parent-id="">
          <input type="hidden" name="parentId" value="" />
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "5px" }}>Name:</label>
              <input type="text" name="author" placeholder="Your name" style={{ padding: "6px", width: "100%", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "5px" }}>Comment:</label>
              <textarea name="body" placeholder="Write your comment here..." style={{ padding: "6px", width: "100%", height: "100px", boxSizing: "border-box" }}></textarea>
            </div>
            <div>
              <button type="submit" style={{ padding: "8px 16px", cursor: "pointer" }}>Submit</button>
            </div>
          </div>
        </Form>
      </div>

      <h2>Discussion</h2>
      <div class="comments-list">
        {comments.value.length === 0 ? (
          <p>No comments yet.</p>
        ) : (
          comments.value.map((comment) => (
            <CommentComponent key={comment.id} comment={comment} action={action} />
          ))
        )}
      </div>
    </div>
  );
});
