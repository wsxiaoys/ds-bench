import { component$ } from "@builder.io/qwik";
import {
  routeLoader$,
  routeAction$,
  zod$,
  z,
  type DocumentHead,
} from "@builder.io/qwik-city";
import {
  buildCommentTree,
  commentExists,
  getAllCommentRows,
  insertComment,
} from "~/lib/db";
import { CommentThread } from "~/components/comments/comment-thread";
import { ReplyForm } from "~/components/comments/reply-form";

export const useCommentsLoader = routeLoader$(() => {
  const rows = getAllCommentRows();
  return buildCommentTree(rows);
});

export const useReplyAction = routeAction$(
  async (data, ev) => {
    const rawParentId = data.parentId?.trim() ?? "";
    let parentId: number | null = null;

    if (rawParentId !== "") {
      const parsed = Number(rawParentId);
      if (!Number.isInteger(parsed) || !commentExists(parsed)) {
        return ev.fail(400, {
          formErrors: ["The comment you're replying to no longer exists."],
        });
      }
      parentId = parsed;
    }

    const comment = insertComment(
      parentId,
      data.author.trim(),
      data.body.trim(),
    );

    return { success: true as const, id: comment.id };
  },
  zod$({
    author: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters long."),
    body: z.string().trim().min(1, "Comment cannot be empty."),
    parentId: z.string().optional(),
  }),
);

function getErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== "object" || !("failed" in value)) {
    return null;
  }
  const failure = value as {
    failed: boolean;
    formErrors?: string[];
    fieldErrors?: Record<string, string>;
  };
  if (!failure.failed) return null;

  const parts: string[] = [];
  if (Array.isArray(failure.formErrors)) {
    parts.push(...failure.formErrors);
  }
  if (failure.fieldErrors) {
    parts.push(...Object.values(failure.fieldErrors).filter(Boolean));
  }
  return parts.length > 0 ? parts.join(" ") : "Something went wrong.";
}

export default component$(() => {
  const comments = useCommentsLoader();
  const action = useReplyAction();

  const errorMessage = getErrorMessage(action.value);

  return (
    <>
      <h1>Comments</h1>

      {errorMessage && <div data-testid="error">{errorMessage}</div>}

      <ul class="comment-list">
        {comments.value.map((comment) => (
          <CommentThread key={comment.id} comment={comment} action={action} />
        ))}
      </ul>

      <h2>Add a new comment</h2>
      <ReplyForm parentId="" action={action} />
    </>
  );
});

export const head: DocumentHead = {
  title: "Threaded Comments",
  meta: [
    {
      name: "description",
      content: "A server-rendered, threaded nested comment system.",
    },
  ],
};
