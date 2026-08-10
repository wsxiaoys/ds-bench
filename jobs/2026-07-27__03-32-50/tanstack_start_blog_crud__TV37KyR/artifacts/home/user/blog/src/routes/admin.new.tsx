import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createPostFn } from '#/server/posts'
import { PostForm } from '#/components/PostForm'
import type { PostFormValues } from '#/components/PostForm'

export const Route = createFileRoute('/admin/new')({
  component: NewPost,
})

function NewPost() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(values: PostFormValues) {
    setSubmitting(true)
    setError(null)
    try {
      await createPostFn({ data: values })
      await navigate({ to: '/admin' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post')
      setSubmitting(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <p className="island-kicker mb-2">Admin</p>
        <h1 className="display-title mb-6 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          New Post
        </h1>
        {error && <p className="demo-alert demo-alert-danger mb-4">{error}</p>}
        <PostForm
          submitLabel="Create Post"
          submitting={submitting}
          onSubmit={handleSubmit}
        />
      </section>
    </main>
  )
}
