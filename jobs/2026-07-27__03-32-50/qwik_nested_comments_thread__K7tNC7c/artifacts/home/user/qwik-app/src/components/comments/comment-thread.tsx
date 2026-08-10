import { component$ } from "@builder.io/qwik";
import type { ActionStore } from "@builder.io/qwik-city";
import type { CommentNode } from "~/lib/db";
import { ReplyForm, type ReplyActionInput, type ReplyActionOutput } from "./reply-form";

interface CommentThreadProps {
  comment: CommentNode;
  action: ActionStore<ReplyActionOutput, ReplyActionInput, false>;
}

/**
 * Recursively renders a single comment followed by its reply form and all
 * of its children, so threads of arbitrary depth are rendered correctly.
 */
export const CommentThread = component$<CommentThreadProps>(
  ({ comment, action }) => {
    return (
      <li
        data-testid="comment"
        data-comment-id={comment.id}
        data-parent-id={comment.parent_id ?? ""}
        data-depth={comment.depth}
        class="comment"
      >
        <div class="comment-header">
          <span class="comment-author">{comment.author}</span>
        </div>
        <p class="comment-body">{comment.body}</p>

        <ReplyForm parentId={String(comment.id)} action={action} />

        {comment.children.length > 0 && (
          <ul class="comment-children">
            {comment.children.map((child) => (
              <CommentThread key={child.id} comment={child} action={action} />
            ))}
          </ul>
        )}
      </li>
    );
  },
);
