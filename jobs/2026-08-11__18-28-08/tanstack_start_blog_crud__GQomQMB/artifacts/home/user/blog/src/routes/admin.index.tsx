import { createFileRoute, useRouter } from '@tanstack/react-router'
import { getPostsFn, deletePostFn } from '../serverFunctions'

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    return getPostsFn({ data: { admin: true } })
  },
  component: AdminIndex,
})

function AdminIndex() {
  const posts = Route.useLoaderData()
  const router = useRouter()

  const handleDelete = async (slug: string) => {
    await deletePostFn({ data: slug })
    await router.invalidate()
  }

  return (
    <main className="page-wrap px-4 py-12">
      <section className="island-shell rounded-2xl p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 border-b border-[var(--line)] pb-6">
          <div>
            <p className="island-kicker mb-1">Admin Dashboard</p>
            <h1 className="text-3xl font-bold text-[var(--sea-ink)]">All Posts</h1>
          </div>
          <a
            href="/admin/new"
            className="rounded-full bg-[var(--lagoon-deep)] text-white px-5 py-2.5 text-sm font-semibold no-underline transition hover:-translate-y-0.5"
          >
            Create New Post
          </a>
        </div>

        <div className="space-y-4">
          {posts.length === 0 ? (
            <p className="text-[var(--sea-ink-soft)] text-center py-8">No posts found. Create one to get started!</p>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="flex flex-wrap items-center justify-between gap-4 p-4 border border-[var(--line)] rounded-xl bg-white/40 hover:bg-white/80 transition"
              >
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-[var(--sea-ink)] truncate m-0">
                    {post.title}
                  </h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        post.published
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {post.published ? 'Published' : 'Draft'}
                    </span>
                    <span className="text-xs text-[var(--sea-ink-soft)]">
                      Slug: <code className="bg-slate-100 px-1 py-0.5 rounded">{post.slug}</code>
                    </span>
                    {post.tags.map((t) => (
                      <span
                        key={t}
                        className="text-xs bg-[var(--chip-bg)] border border-[var(--chip-line)] px-2 py-0.5 rounded-full text-[var(--lagoon-deep)]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`/admin/${post.slug}/edit`}
                    className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white px-4 py-2 text-xs font-semibold text-[var(--sea-ink)] no-underline transition hover:bg-slate-50"
                  >
                    Edit
                  </a>
                  <button
                    data-testid={`delete-${post.slug}`}
                    onClick={() => handleDelete(post.slug)}
                    className="rounded-full bg-red-500 hover:bg-red-600 text-white px-4 py-2 text-xs font-semibold transition cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}
