import { createFileRoute, Link, useRouter } from '@tanstack/react-router'
import { getAllPostsFn, deletePostFn } from '../posts.functions'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    return getAllPostsFn()
  },
  component: AdminIndex,
})

function AdminIndex() {
  const posts = Route.useLoaderData()
  const router = useRouter()

  const handleDelete = async (slug: string) => {
    if (confirm('Are you sure you want to delete this post?')) {
      await deletePostFn({ data: slug })
      router.invalidate()
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14 max-w-4xl mx-auto">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-[var(--sea-ink)]">
          Admin Dashboard
        </h1>
        <Link
          to="/admin/new"
          className="rounded-full bg-[var(--lagoon-deep)] text-white px-5 py-2.5 text-sm font-semibold hover:bg-[rgba(50,143,151,0.9)] transition"
        >
          Create New Post
        </Link>
      </header>

      {posts.length === 0 ? (
        <div className="island-shell rounded-2xl p-8 text-center text-gray-500">
          No posts found. Start by creating one!
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="island-shell rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-semibold text-[var(--sea-ink)]">
                    {post.title}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      post.published
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}
                  >
                    {post.published ? 'Published' : 'Draft'}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Slug: <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded">{post.slug}</code>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {post.tags.map((t) => (
                    <span
                      key={t}
                      className="bg-gray-100 dark:bg-gray-800 text-xs px-2 py-0.5 rounded text-gray-600 dark:text-gray-400"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <Link
                  to={`/posts/${post.slug}`}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
                >
                  View
                </Link>
                <Link
                  to={`/admin/${post.slug}/edit`}
                  className="text-sm text-[var(--lagoon-deep)] hover:underline"
                >
                  Edit
                </Link>
                <button
                  data-testid={`delete-${post.slug}`}
                  onClick={() => handleDelete(post.slug)}
                  className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 px-3.5 py-1.5 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
