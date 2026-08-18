import { createFileRoute, Link } from '@tanstack/react-router'
import { getPublishedPostsFn } from '../posts.functions'
import { z } from 'zod'

const searchSchema = z.object({
  tag: z.string().optional(),
})

export const Route = createFileRoute('/')({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search: { tag } }) => ({ tag }),
  loader: async ({ deps: { tag } }) => {
    return getPublishedPostsFn({ data: tag })
  },
  component: App,
})

function App() {
  const posts = Route.useLoaderData()
  const { tag } = Route.useSearch()

  return (
    <main className="page-wrap px-4 pb-8 pt-14 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--sea-ink)] mb-2">
          {tag ? `Posts tagged with "${tag}"` : 'Published Posts'}
        </h1>
        {tag && (
          <Link
            to="/"
            className="text-sm text-[var(--lagoon-deep)] hover:underline"
          >
            &larr; Clear tag filter
          </Link>
        )}
      </header>

      {posts.length === 0 ? (
        <p className="text-gray-500">No published posts found.</p>
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <article key={post.id} className="island-shell rounded-2xl p-6">
              <h2 className="text-2xl font-semibold mb-2">
                <a
                  href={`/posts/${post.slug}`}
                  className="text-[var(--sea-ink)] hover:text-[var(--lagoon-deep)] transition"
                >
                  {post.title}
                </a>
              </h2>
              <div className="flex flex-wrap gap-2 mt-3">
                {post.tags.map((t) => (
                  <Link
                    key={t}
                    to="/"
                    search={{ tag: t }}
                    className="bg-gray-100 dark:bg-gray-800 text-xs px-2.5 py-1 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    #{t}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
