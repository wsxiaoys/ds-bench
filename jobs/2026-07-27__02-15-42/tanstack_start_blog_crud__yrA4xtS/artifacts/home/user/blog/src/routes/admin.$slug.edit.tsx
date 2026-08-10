import React, { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getPostBySlug, updatePost } from '../posts'

export const Route = createFileRoute('/admin/$slug/edit')({
  loader: async ({ params: { slug } }) => {
    const post = await getPostBySlug({ data: slug })
    if (!post) {
      throw new Error('Post not found')
    }
    return { post }
  },
  component: AdminEdit,
})

function AdminEdit() {
  const { post } = Route.useLoaderData()
  const router = useRouter()

  const [title, setTitle] = useState(post.title)
  const [body, setBody] = useState(post.body)
  const [tags, setTags] = useState(post.tags.join(', '))
  const [published, setPublished] = useState(!!post.published)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setIsSubmitting(true)
    setError('')
    try {
      await updatePost({
        data: {
          id: post.id,
          title,
          body,
          tags,
          published,
        },
      })
      router.navigate({ to: '/admin' })
    } catch (err: any) {
      setError(err?.message || 'An error occurred while updating the post')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14 max-w-3xl mx-auto">
      <section className="island-shell rounded-2xl p-6 mb-8">
        <h1 className="text-3xl font-bold text-[var(--sea-ink)] mb-2">Edit Post</h1>
        <p className="text-sm text-[var(--sea-ink-soft)]">Update your blog post content.</p>
      </section>

      <form onSubmit={handleSubmit} className="island-shell rounded-2xl p-6 space-y-6">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Title
          </label>
          <input
            type="text"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[var(--lagoon-deep)] focus:border-transparent outline-none transition text-sm"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Body (Markdown)
          </label>
          <textarea
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={12}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[var(--lagoon-deep)] focus:border-transparent outline-none transition text-sm font-mono"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Tags
          </label>
          <input
            type="text"
            name="tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-[var(--lagoon-deep)] focus:border-transparent outline-none transition text-sm"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            name="published"
            id="published"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 text-[var(--lagoon-deep)] focus:ring-[var(--lagoon-deep)] border-gray-300 rounded transition"
          />
          <label htmlFor="published" className="ml-2 block text-sm font-semibold text-gray-700 select-none">
            Published (visible on public list)
          </label>
        </div>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-100">
          <a
            href="/admin"
            className="rounded-full border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition no-underline"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-[var(--lagoon-deep)] text-white px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Saving...' : 'Save Post'}
          </button>
        </div>
      </form>
    </main>
  )
}
