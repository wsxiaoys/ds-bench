import { createFileRoute, useNavigate, Link, notFound } from '@tanstack/react-router'
import { getPostBySlugFn, updatePostFn } from '../posts.functions'
import { useState, useEffect } from 'react'

export const Route = createFileRoute('/admin/$slug/edit')({
  loader: async ({ params: { slug } }) => {
    const post = await getPostBySlugFn({ data: { slug, includeDrafts: true } })
    if (!post) {
      throw notFound()
    }
    return post
  },
  component: AdminEdit,
  notFoundComponent: () => {
    return (
      <main className="page-wrap px-4 py-12 text-center max-w-xl mx-auto">
        <h1 className="text-4xl font-bold text-red-600 mb-4">Not Found</h1>
        <p className="text-gray-600 mb-6">The requested post does not exist.</p>
        <Link to="/admin" className="text-[var(--lagoon-deep)] hover:underline">
          &larr; Back to dashboard
        </Link>
      </main>
    )
  }
})

function AdminEdit() {
  const post = Route.useLoaderData()
  const navigate = useNavigate()

  const [title, setTitle] = useState(post.title)
  const [body, setBody] = useState(post.body)
  const [tags, setTags] = useState(post.tags.join(', '))
  const [published, setPublished] = useState(post.published === 1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Ensure state resets if loader data changes
  useEffect(() => {
    setTitle(post.title)
    setBody(post.body)
    setTags(post.tags.join(', '))
    setPublished(post.published === 1)
  }, [post])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      await updatePostFn({
        data: {
          currentSlug: post.slug,
          title,
          body,
          tags: parsedTags,
          published: published ? 1 : 0,
        },
      })

      navigate({ to: '/admin' })
    } catch (err) {
      console.error(err)
      alert('Error updating post')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14 max-w-2xl mx-auto">
      <header className="mb-8">
        <Link to="/admin" className="text-sm text-[var(--lagoon-deep)] hover:underline mb-4 inline-block">
          &larr; Back to dashboard
        </Link>
        <h1 className="text-3xl font-bold text-[var(--sea-ink)]">
          Edit Post: {post.title}
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="island-shell rounded-2xl p-6 md:p-8 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-[var(--sea-ink)] mb-2">
            Title
          </label>
          <input
            type="text"
            name="title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon-deep)]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[var(--sea-ink)] mb-2">
            Body (Markdown)
          </label>
          <textarea
            name="body"
            required
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon-deep)] font-mono text-sm"
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
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-[var(--sea-ink)] focus:outline-none focus:ring-2 focus:ring-[var(--lagoon-deep)]"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="published"
            id="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-[var(--lagoon-deep)] focus:ring-[var(--lagoon-deep)]"
          />
          <label htmlFor="published" className="ml-2 block text-sm font-semibold text-[var(--sea-ink)]">
            Publish this post
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Link
            to="/admin"
            className="px-5 py-2.5 rounded-full border border-gray-300 dark:border-gray-700 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-full bg-[var(--lagoon-deep)] text-white text-sm font-semibold hover:bg-[rgba(50,143,151,0.9)] transition disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </main>
  )
}
