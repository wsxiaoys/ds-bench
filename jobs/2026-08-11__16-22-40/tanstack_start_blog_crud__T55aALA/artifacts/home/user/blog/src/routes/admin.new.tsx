import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { createPostFn } from '../posts.functions'
import { useState } from 'react'

export const Route = createFileRoute('/admin/new')({
  component: AdminNew,
})

function AdminNew() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [published, setPublished] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0)

      await createPostFn({
        data: {
          title,
          body,
          tags: parsedTags,
          published: published ? 1 : 0,
        },
      })

      navigate({ to: '/admin' })
    } catch (err) {
      console.error(err)
      alert('Error creating post')
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
          Create New Post
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
            placeholder="e.g. My First Blog Post"
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
            placeholder="Write your post content in Markdown here..."
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
            placeholder="e.g. tech, react, start"
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
            Publish this post immediately
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
            {isSubmitting ? 'Saving...' : 'Save Post'}
          </button>
        </div>
      </form>
    </main>
  )
}
