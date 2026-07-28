import { component$ } from "@builder.io/qwik";
import { Form, type ActionStore } from "@builder.io/qwik-city";

export interface ReplyActionInput {
  parentId?: string;
  author: string;
  body: string;
}

export interface ReplyActionSuccess {
  success: true;
  id: number;
}

// The action can also resolve to a qwik-city `FailReturn` shape
// (`{ failed: true, formErrors, fieldErrors }`), which is handled
// generically wherever `action.value` is inspected.
export type ReplyActionOutput = ReplyActionSuccess | Record<string, any>;

interface ReplyFormProps {
  /** Empty string means "create a new root comment". */
  parentId: string;
  action: ActionStore<ReplyActionOutput, ReplyActionInput, false>;
}

export const ReplyForm = component$<ReplyFormProps>(({ parentId, action }) => {
  return (
    <Form
      action={action}
      data-testid="reply-form"
      data-parent-id={parentId}
      class="reply-form"
    >
      <input type="hidden" name="parentId" value={parentId} />
      <div class="reply-form-row">
        <label>
          Name
          <input type="text" name="author" required minLength={2} />
        </label>
      </div>
      <div class="reply-form-row">
        <label>
          Comment
          <textarea name="body" required></textarea>
        </label>
      </div>
      <button type="submit">
        {parentId ? "Reply" : "Post new comment"}
      </button>
    </Form>
  );
});
