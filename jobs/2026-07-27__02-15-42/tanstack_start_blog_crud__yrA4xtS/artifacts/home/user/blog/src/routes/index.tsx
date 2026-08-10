import { createFileRoute } from '@tanstack/react-router'
import { getPublishedPosts } from '../posts'

type PostSearch = {
  tag?: string
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): PostSearch => {
    return {
      tag: search.tag as string | undefined,
    }
  },
  loaderDeps: ({ search: { tag } }) => ({ tag }),
  loader: async ({ deps: { tag } }) => {
    const posts = await getPublishedPosts({ data: tag })
    return { posts }
  },
  component: Home,
})

function Home() {
  const { posts } = Route.useLoaderData()
  const { tag } = Route.useSearch()

  return (
    <main className="page-wrap px-4 pb-8 pt-14 max-w-4xl mx-auto">
      <section className="island-shell rise-in relative overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14 mb-8">
        <div className="pointer-events-none absolute -left-20 -top-24 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.32),transparent_66%)]" />
        <div className="pointer-events-none absolute -bottom-20 -right-20 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_66%)]" />
        
        <p className="island-kicker mb-3">Welcome to our Full-Stack Blog</p>
        <h1 className="display-title mb-5 text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
          The Latest Insights
        </h1>
        <p className="mb-4 max-w-2xl text-base text-[var(--sea-ink-soft)] sm:text-lg">
          Explore articles on technology, development, and standard full-stack practices.
        </p>

        {tag && (
          <div className="mt-4 flex items-center gap-3">
            <span className="bg-[rgba(79,184,178,0.14)] text-[var(--lagoon-deep)] border border-[rgba(50,143,151,0.3)] px-3 py-1 rounded-full text-sm font-semibold">
              Tag: {tag}
            </span>
            <a
              href="/"
              className="text-sm font-medium text-gray-500 hover:text-gray-800 underline"
            >
              Clear filter
            </a>
          </div>
        )}
      </section>

      <section className="space-y-6">
        {posts.length === 0 ? (
          <div className="island-shell p-8 rounded-2xl text-center text-[var(--sea-ink-soft)]">
            No posts found.
          </div>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="island-shell rounded-2xl p-6 hover:shadow-md transition">
              <h2 className="text-2xl font-bold mb-2">
                <a
                  href={`/posts/${post.slug}`}
                  className="text-[var(--sea-ink)] hover:text-[var(--lagoon-deep)] transition"
                >
                  {post.title}
                </a>
              </h2>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((t: string) => (
                  <a
                    key={t}
                    href={`/?tag=${encodeURIComponent(t)}`}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs transition"
                  >
                    #{t}
                  </a>
                ))}
              </div>

              <p className="text-[var(--sea-ink-soft)] line-clamp-3">
                {post.body.length > 150 ? `${post.body.substring(0, 150)}...` : post.body}
              </p>
            </article>
          ))
        )}
      </section>
    </main>
  )
}
