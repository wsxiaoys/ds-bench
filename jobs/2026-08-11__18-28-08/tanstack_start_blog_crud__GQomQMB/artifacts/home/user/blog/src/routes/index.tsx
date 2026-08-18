import { createFileRoute } from '@tanstack/react-router'
import { getPostsFn } from '../serverFunctions'

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tag: typeof search.tag === 'string' ? search.tag : undefined,
    }
  },
  loaderDeps: ({ search: { tag } }) => ({ tag }),
  loader: async ({ deps: { tag } }) => {
    return getPostsFn({ data: { tag, admin: false } })
  },
  component: App,
})

function App() {
  const posts = Route.useLoaderData()
  const { tag } = Route.useSearch()

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14 mb-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        <p className="island-kicker mb-3">Welcome to our Blog</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
          Thoughts, ideas, and stories.
        </h1>
        {tag && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--sea-ink-soft)]">
              Filtering by tag: <strong className="text-[var(--lagoon-deep)]">#{tag}</strong>
            </span>
            <a
              href="/"
              className="rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-3 py-1 text-xs font-semibold text-[var(--sea-ink)] no-underline transition hover:bg-white"
            >
              Clear filter
            </a>
          </div>
        )}
      </section>

      <section className="space-y-6">
        {posts.length === 0 ? (
          <div className="island-shell rounded-2xl p-8 text-center text-[var(--sea-ink-soft)]">
            No posts found.
          </div>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="island-shell rounded-2xl p-6 sm:p-8">
              <h2 className="text-2xl font-bold mb-2">
                <a
                  href={`/posts/${post.slug}`}
                  className="text-[var(--sea-ink)] hover:text-[var(--lagoon-deep)] transition no-underline"
                >
                  {post.title}
                </a>
              </h2>
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((t) => (
                  <a
                    key={t}
                    href={`/?tag=${encodeURIComponent(t)}`}
                    className="rounded-full bg-[var(--chip-bg)] border border-[var(--chip-line)] px-3 py-1 text-xs font-semibold text-[var(--lagoon-deep)] transition hover:bg-[rgba(79,184,178,0.24)]"
                  >
                    #{t}
                  </a>
                ))}
              </div>
              <p className="text-[var(--sea-ink-soft)] line-clamp-3 mb-0">
                {post.body.length > 200 ? `${post.body.slice(0, 200)}...` : post.body}
              </p>
            </article>
          ))
        )}
      </section>
    </main>
  )
}
