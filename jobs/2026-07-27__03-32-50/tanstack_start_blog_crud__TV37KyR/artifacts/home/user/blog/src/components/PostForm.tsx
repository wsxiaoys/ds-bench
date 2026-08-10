import { useState } from 'react'

export interface PostFormValues {
  title: string
  body: string
  tags: string
  published: boolean
}

interface PostFormProps {
  initialValues?: PostFormValues
  submitLabel: string
  submitting?: boolean
  onSubmit: (values: PostFormValues) => void | Promise<void>
}

const emptyValues: PostFormValues = {
  title: '',
  body: '',
  tags: '',
  published: false,
}

export function PostForm({
  initialValues,
  submitLabel,
  submitting,
  onSubmit,
}: PostFormProps) {
  const [values, setValues] = useState<PostFormValues>(
    initialValues ?? emptyValues,
  )

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit(values)
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-[var(--sea-ink)]">
          Title
        </span>
        <input
          className="demo-input"
          name="title"
          type="text"
          value={values.title}
          onChange={(event) =>
            setValues((v) => ({ ...v, title: event.target.value }))
          }
          required
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-[var(--sea-ink)]">
          Body (Markdown)
        </span>
        <textarea
          className="demo-textarea"
          name="body"
          rows={14}
          value={values.body}
          onChange={(event) =>
            setValues((v) => ({ ...v, body: event.target.value }))
          }
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-[var(--sea-ink)]">
          Tags (comma-separated)
        </span>
        <input
          className="demo-input"
          name="tags"
          type="text"
          placeholder="react, typescript, tutorial"
          value={values.tags}
          onChange={(event) =>
            setValues((v) => ({ ...v, tags: event.target.value }))
          }
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="published"
          checked={values.published}
          onChange={(event) =>
            setValues((v) => ({ ...v, published: event.target.checked }))
          }
        />
        <span className="text-sm font-semibold text-[var(--sea-ink)]">
          Published
        </span>
      </label>

      <div>
        <button type="submit" className="demo-button" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  )
}
