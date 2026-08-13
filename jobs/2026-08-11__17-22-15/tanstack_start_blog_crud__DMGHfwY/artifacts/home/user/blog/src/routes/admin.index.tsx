import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { getAllPostsFn, deletePostFn } from '../serverFunctions'
import { useState } from 'react'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    const posts = await getAllPostsFn()
    return { posts }
  },
  component: AdminIndex
})

function AdminIndex() {
  const { posts } = Route.useLoaderData()
  const router = useRouter()
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null)

  const handleDelete = async (slug: string) => {
    if (!confirm('Are you sure you want to permanently delete this post?')) {
      return
    }

    setDeletingSlug(slug)
    try {
      await deletePostFn({ data: slug })
      // Invalidate router to reload the loader and refresh data
      await router.invalidate()
    } catch (error) {
      console.error('Failed to delete post:', error)
      alert('Failed to delete post. Please try again.')
    } finally {
      setDeletingSlug(null)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <p className="island-kicker mb-1">Content Management</p>
          <h1 className="text-4xl font-extrabold text-[var(--sea-ink)]">Admin Dashboard</h1>
        </div>
        <Link
          to="/admin/new"
          className="rounded-full bg-[var(--lagoon-deep)] hover:bg-[var(--lagoon)] px-6 py-3 text-sm font-semibold text-white no-underline shadow-md transition hover:-translate-y-0.5"
        >
          Create New Post
        </Link>
      </div>

      <div className="island-shell rounded-2xl overflow-hidden">
        {posts.length === 0 ? (
          <div className="p-8 text-center text-[var(--sea-ink-soft)]">
            No posts found. Create your first post!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--line)] bg-[rgba(23,58,64,0.03)]">
                  <th className="p-4 text-sm font-bold text-[var(--sea-ink)]">Title</th>
                  <th className="p-4 text-sm font-bold text-[var(--sea-ink)]">Slug</th>
                  <th className="p-4 text-sm font-bold text-[var(--sea-ink)]">Status</th>
                  <th className="p-4 text-sm font-bold text-[var(--sea-ink)]">Tags</th>
                  <th className="p-4 text-sm font-bold text-[var(--sea-ink)] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {posts.map(post => (
                  <tr key={post.id} className="hover:bg-[rgba(255,255,255,0.3)] transition">
                    <td className="p-4 font-semibold text-[var(--sea-ink)]">
                      {post.title}
                    </td>
                    <td className="p-4 text-sm text-[var(--sea-ink-soft)] font-mono">
                      {post.slug}
                    </td>
                    <td className="p-4 text-sm">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          post.published
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            post.published ? 'bg-green-500' : 'bg-yellow-500'
                          }`}
                        />
                        {post.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {post.tags.map(t => (
                          <span
                            key={t}
                            className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2 py-0.5 text-xs text-[var(--sea-ink)]"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <Link
                        to="/admin/$slug/edit"
                        params={{ slug: post.slug }}
                        className="inline-flex items-center rounded-lg border border-[var(--chip-line)] bg-white/50 px-3 py-1.5 text-xs font-semibold text-[var(--sea-ink)] no-underline hover:bg-white transition"
                      >
                        Edit
                      </Link>
                      <button
                        data-testid={`delete-${post.slug}`}
                        onClick={() => handleDelete(post.slug)}
                        disabled={deletingSlug === post.slug}
                        className="inline-flex items-center rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-900/30 border border-red-200 dark:border-red-900/50 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 transition disabled:opacity-50"
                      >
                        {deletingSlug === post.slug ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
