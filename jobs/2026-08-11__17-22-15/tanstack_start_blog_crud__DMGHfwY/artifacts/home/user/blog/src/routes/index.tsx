import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { getPublishedPostsFn } from '../serverFunctions'

const searchSchema = z.object({
  tag: z.string().optional()
})

export const Route = createFileRoute('/')({
  validateSearch: searchSchema,
  loaderDeps: ({ search: { tag } }) => ({ tag }),
  loader: async ({ deps: { tag } }) => {
    const posts = await getPublishedPostsFn({ data: tag })
    return { posts, tag }
  },
  component: Home
})

function App() {
  const { posts, tag } = Route.useLoaderData()

  // Extract all unique tags from published posts to show a filter bar
  const allTags = Array.from(
    new Set(posts.flatMap(p => p.tags))
  ).sort()

  return (
    <main className="page-wrap px-4 pb-8 pt-10">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-12 mb-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <p className="island-kicker mb-3">Welcome to our Blog</p>
        <h1 className="display-title mb-4 text-4xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
          {tag ? `Posts tagged with "${tag}"` : 'Latest Articles'}
        </h1>
        <p className="mb-6 max-w-2xl text-base text-[var(--sea-ink-soft)]">
          {tag 
            ? `Showing all published posts matching the tag "${tag}".`
            : 'Explore our collection of articles, tutorials, and insights written in Markdown and rendered on the fly.'}
        </p>

        {tag && (
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-4 py-2 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5 hover:bg-white"
          >
            Clear Filter
          </Link>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-4">
        {/* Sidebar / Tags */}
        <aside className="lg:col-span-1">
          <div className="island-shell rounded-2xl p-5 sticky top-24">
            <h2 className="mb-4 text-lg font-bold text-[var(--sea-ink)]">Tags</h2>
            {allTags.length === 0 ? (
              <p className="text-sm text-[var(--sea-ink-soft)]">No tags found.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allTags.map(t => {
                  const isActive = t === tag
                  return (
                    <Link
                      key={t}
                      to="/"
                      search={{ tag: t }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold no-underline transition ${
                        isActive
                          ? 'bg-[var(--lagoon-deep)] text-white'
                          : 'border border-[var(--chip-line)] bg-[var(--chip-bg)] text-[var(--sea-ink)] hover:bg-[var(--link-bg-hover)]'
                      }`}
                    >
                      {t}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Posts List */}
        <section className="lg:col-span-3 space-y-6">
          {posts.length === 0 ? (
            <div className="island-shell rounded-2xl p-8 text-center">
              <p className="text-base text-[var(--sea-ink-soft)]">No posts found.</p>
            </div>
          ) : (
            posts.map(post => (
              <article key={post.id} className="island-shell rounded-2xl p-6 transition-all hover:translate-x-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-[var(--sea-ink-soft)]">
                    {new Date(post.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>

                {/* Post Title MUST be an anchor element whose href is exactly /posts/<slug> */}
                <h2 className="text-2xl font-bold mb-3">
                  <a
                    href={`/posts/${post.slug}`}
                    className="text-[var(--sea-ink)] hover:text-[var(--lagoon-deep)] no-underline transition"
                  >
                    {post.title}
                  </a>
                </h2>

                <p className="text-base text-[var(--sea-ink-soft)] mb-4 line-clamp-3">
                  {post.body.replace(/[#*`_\[\]]/g, '').slice(0, 200)}...
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {post.tags.map(t => (
                    <Link
                      key={t}
                      to="/"
                      search={{ tag: t }}
                      className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--sea-ink)] no-underline hover:bg-[var(--link-bg-hover)] transition"
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  )
}

function Home() {
  return <App />
}
