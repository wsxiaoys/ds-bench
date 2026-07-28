import { useState } from 'react'
import { Link, createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { getPostForEdit, updatePostFn } from '#/server/posts'
import { PostForm } from '#/components/PostForm'
import type { PostFormValues } from '#/components/PostForm'

export const Route = createFileRoute('/admin/$slug/edit')({
  loader: async ({ params }) => {
    const post = await getPostForEdit({ data: params.slug })
    if (!post) throw notFound()
    return post
  },
  component: EditPost,
  notFoundComponent: () => (
    <main className="page-wrap px-4 py-14 text-center">
      <h1 className="display-title mb-3 text-4xl font-bold">Not Found</h1>
      <p className="mb-6 text-[var(--sea-ink-soft)]">
        This post could not be found.
      </p>
      <Link to="/admin" className="demo-button no-underline">
        Back to admin
      </Link>
    </main>
  ),
})

function EditPost() {
  const post = Route.useLoaderData()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(values: PostFormValues) {
    setSubmitting(true)
    setError(null)
    try {
      await updatePostFn({ data: { slug: post.slug, ...values } })
      await navigate({ to: '/admin' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update post')
      setSubmitting(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <p className="island-kicker mb-2">Admin</p>
        <h1 className="display-title mb-6 text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
          Edit Post
        </h1>
        {error && <p className="demo-alert demo-alert-danger mb-4">{error}</p>}
        <PostForm
          initialValues={{
            title: post.title,
            body: post.body,
            tags: post.tags.join(', '),
            published: post.published,
          }}
          submitLabel="Save Changes"
          submitting={submitting}
          onSubmit={handleSubmit}
        />
      </section>
    </main>
  )
}
