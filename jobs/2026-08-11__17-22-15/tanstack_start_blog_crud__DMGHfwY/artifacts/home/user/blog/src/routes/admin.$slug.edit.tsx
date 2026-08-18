import { createFileRoute, useNavigate, Link, notFound } from '@tanstack/react-router'
import { getAdminPostFn, updatePostFn } from '../serverFunctions'
import { parseTags } from '../utils'
import { useState } from 'react'

export const Route = createFileRoute('/admin/$slug/edit')({
  loader: async ({ params }) => {
    const post = await getAdminPostFn({ data: params.slug })
    if (!post) {
      throw notFound()
    }
    return { post }
  },
  component: AdminEdit,
  notFoundComponent: () => {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8 text-center">
          <h1 className="text-4xl font-bold text-[var(--sea-ink)] mb-4">Post Not Found</h1>
          <p className="text-base text-[var(--sea-ink-soft)] mb-6">
            The post you are trying to edit does not exist.
          </p>
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5 hover:bg-white"
          >
            Back to Dashboard
          </Link>
        </section>
      </main>
    )
  }
})

function AdminEdit() {
  const { post } = Route.useLoaderData()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const title = formData.get('title') as string
    const body = formData.get('body') as string
    const tagsRaw = formData.get('tags') as string
    const published = formData.get('published') === 'on'

    if (!title.trim()) {
      setError('Title is required.')
      setIsSubmitting(false)
      return
    }

    const tags = parseTags(tagsRaw)

    try {
      await updatePostFn({
        data: {
          id: post.id,
          title,
          body,
          tags,
          published
        }
      })
      navigate({ to: '/admin' })
    } catch (err) {
      console.error('Failed to update post:', err)
      setError('Failed to update post. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-10">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            to="/admin"
            className="text-sm font-semibold text-[var(--lagoon-deep)] hover:underline no-underline"
          >
            &larr; Back to Dashboard
          </Link>
        </div>

        <section className="island-shell rounded-2xl p-6 sm:p-8">
          <p className="island-kicker mb-1">Editing Entry</p>
          <h1 className="text-3xl font-extrabold text-[var(--sea-ink)] mb-6">Edit Post</h1>

          {error && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-bold text-[var(--sea-ink)] mb-2">
                Title
              </label>
              <input
                id="title"
                type="text"
                name="title"
                required
                defaultValue={post.title}
                placeholder="Enter post title"
                className="w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3 text-base text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon-deep)] focus:border-transparent transition"
              />
            </div>

            <div>
              <label htmlFor="body" className="block text-sm font-bold text-[var(--sea-ink)] mb-2">
                Body (Markdown)
              </label>
              <textarea
                id="body"
                name="body"
                required
                rows={10}
                defaultValue={post.body}
                placeholder="Write your post content in Markdown..."
                className="w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3 text-base text-[var(--sea-ink)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--lagoon-deep)] focus:border-transparent transition"
              />
            </div>

            <div>
              <label htmlFor="tags" className="block text-sm font-bold text-[var(--sea-ink)] mb-2">
                Tags (comma-separated)
              </label>
              <input
                id="tags"
                type="text"
                name="tags"
                defaultValue={post.tags.join(', ')}
                placeholder="react, start, sqlite"
                className="w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-3 text-base text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon-deep)] focus:border-transparent transition"
              />
            </div>

            <div className="flex items-center gap-3 bg-[rgba(23,58,64,0.02)] p-4 rounded-xl border border-[var(--line)]">
              <input
                id="published"
                type="checkbox"
                name="published"
                defaultChecked={post.published}
                className="h-5 w-5 rounded border-[var(--line)] text-[var(--lagoon-deep)] focus:ring-[var(--lagoon-deep)] transition"
              />
              <label htmlFor="published" className="text-sm font-semibold text-[var(--sea-ink)] cursor-pointer select-none">
                Publish this post immediately (Draft otherwise)
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--line)]">
              <Link
                to="/admin"
                className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-6 py-3 text-sm font-semibold text-[var(--sea-ink)] no-underline hover:bg-[var(--link-bg-hover)] transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-full bg-[var(--lagoon-deep)] hover:bg-[var(--lagoon)] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Post'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}
