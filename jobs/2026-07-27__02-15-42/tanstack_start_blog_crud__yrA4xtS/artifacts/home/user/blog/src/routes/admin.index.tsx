import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getAllPosts, deletePost } from '../posts'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    const posts = await getAllPosts()
    return { posts }
  },
  component: AdminIndex,
})

function AdminIndex() {
  const { posts } = Route.useLoaderData()
  const router = useRouter()

  const handleDelete = async (slug: string) => {
    if (confirm('Are you sure you want to delete this post?')) {
      await deletePost({ data: slug })
      router.invalidate()
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14 max-w-5xl mx-auto">
      <section className="island-shell rounded-2xl p-6 mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[var(--sea-ink)]">Admin Dashboard</h1>
          <p className="text-sm text-[var(--sea-ink-soft)]">Manage all your blog posts here.</p>
        </div>
        <a
          href="/admin/new"
          className="rounded-full bg-[var(--lagoon-deep)] text-white px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition no-underline"
        >
          Create New Post
        </a>
      </section>

      <div className="island-shell rounded-2xl overflow-hidden">
        {posts.length === 0 ? (
          <div className="p-8 text-center text-[var(--sea-ink-soft)]">
            No posts found. Create your first post using the button above!
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="p-4">Title</th>
                <th className="p-4">Slug</th>
                <th className="p-4">Status</th>
                <th className="p-4">Tags</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 text-sm">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 font-semibold text-gray-900">{post.title}</td>
                  <td className="p-4 text-gray-500">{post.slug}</td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        post.published
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {post.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500">
                    {post.tags.map((t: string) => `#${t}`).join(', ') || '-'}
                  </td>
                  <td className="p-4 text-right space-x-3">
                    <a
                      href={`/admin/${post.slug}/edit`}
                      className="text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Edit
                    </a>
                    <button
                      data-testid={`delete-${post.slug}`}
                      onClick={() => handleDelete(post.slug)}
                      className="text-red-600 hover:text-red-800 font-semibold cursor-pointer"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  )
}
