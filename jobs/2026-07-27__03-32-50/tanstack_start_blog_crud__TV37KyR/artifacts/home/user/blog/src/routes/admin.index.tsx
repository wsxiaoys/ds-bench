import { useState } from 'react'
import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { deletePostFn, getAllPostsList } from '#/server/posts'

export const Route = createFileRoute('/admin/')({
  loader: async () => getAllPostsList(),
  component: AdminList,
})

function AdminList() {
  const posts = Route.useLoaderData()
  const router = useRouter()
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)

  async function handleDelete(slug: string) {
    setPendingSlug(slug)
    try {
      await deletePostFn({ data: slug })
      await router.invalidate()
    } finally {
      setPendingSlug(null)
    }
  }

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="island-kicker mb-2">Admin</p>
            <h1 className="display-title text-3xl font-bold text-[var(--sea-ink)] sm:text-4xl">
              All Posts
            </h1>
          </div>
          <Link to="/admin/new" className="demo-button no-underline">
            New Post
          </Link>
        </div>

        {posts.length === 0 ? (
          <p className="text-[var(--sea-ink-soft)]">No posts yet.</p>
        ) : (
          <div className="demo-table-shell">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Tags</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.slug}>
                    <td>{post.title}</td>
                    <td>
                      <span className="demo-pill">
                        {post.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td>{post.tags.join(', ')}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to="/admin/$slug/edit"
                          params={{ slug: post.slug }}
                          className="demo-button demo-button-secondary no-underline"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          data-testid={`delete-${post.slug}`}
                          className="demo-button demo-button-danger"
                          disabled={pendingSlug === post.slug}
                          onClick={() => handleDelete(post.slug)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}
