import { createFileRoute, useNavigate, notFound } from '@tanstack/react-router'
import { useState } from 'react'
import { getPostBySlugFn, updatePostFn } from '../serverFunctions'

export const Route = createFileRoute('/admin/$slug/edit')({
  loader: async ({ params: { slug } }) => {
    const post = await getPostBySlugFn({ data: slug })
    if (!post) {
      throw notFound()
    }
    return post
  },
  component: AdminEdit,
})

function AdminEdit() {
  const post = Route.useLoaderData()
  const navigate = useNavigate()

  const [title, setTitle] = useState(post.title)
  const [body, setBody] = useState(post.body)
  const [tags, setTags] = useState(post.tags.join(', '))
  const [published, setPublished] = useState(post.published)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await updatePostFn({
        data: {
          id: post.id,
          title,
          body,
          tags,
          published,
        },
      })
      navigate({ to: '/admin' })
    } catch (err: any) {
      setError(err?.message || 'Failed to update post')
      setSubmitting(false)
    }
  }

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto">
        <div className="mb-6 border-b border-[var(--line)] pb-4">
          <p className="island-kicker mb-1">Admin Dashboard</p>
          <h1 className="text-3xl font-bold text-[var(--sea-ink)]">Edit Post</h1>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-[var(--sea-ink)] mb-2">
              Title
            </label>
            <input
              type="text"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title"
              className="w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-2.5 text-sm text-[var(--sea-ink)] focus:border-[var(--lagoon-deep)] focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--sea-ink)] mb-2">
              Body (Markdown)
            </label>
            <textarea
              name="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your post content in Markdown..."
              rows={10}
              className="w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-2.5 text-sm text-[var(--sea-ink)] focus:border-[var(--lagoon-deep)] focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--sea-ink)] mb-2">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              name="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. news, tech, updates"
              className="w-full rounded-xl border border-[var(--line)] bg-white/50 px-4 py-2.5 text-sm text-[var(--sea-ink)] focus:border-[var(--lagoon-deep)] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="published"
              name="published"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--line)] text-[var(--lagoon-deep)] focus:ring-[var(--lagoon-deep)]"
            />
            <label htmlFor="published" className="text-sm font-semibold text-[var(--sea-ink)]">
              Publish immediately (checked means published, unchecked means draft)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--line)]">
            <a
              href="/admin"
              className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:bg-slate-50"
            >
              Cancel
            </a>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-[var(--lagoon-deep)] hover:bg-[var(--lagoon-deep)]/90 text-white px-5 py-2.5 text-sm font-semibold transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Post'}
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
