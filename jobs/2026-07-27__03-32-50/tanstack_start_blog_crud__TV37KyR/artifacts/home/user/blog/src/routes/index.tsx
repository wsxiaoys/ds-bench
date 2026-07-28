import { Link, createFileRoute } from '@tanstack/react-router'
import { getPublishedPostsList } from '#/server/posts'

interface IndexSearch {
  tag?: string
}

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): IndexSearch => {
    const tag = search.tag
    return { tag: typeof tag === 'string' && tag.length > 0 ? tag : undefined }
  },
  loaderDeps: ({ search }) => ({ tag: search.tag }),
  loader: async ({ deps }) => getPublishedPostsList({ data: { tag: deps.tag } }),
  component: PostList,
})

function PostList() {
  const posts = Route.useLoaderData()
  const { tag } = Route.useSearch()

  const allTags = Array.from(new Set(posts.flatMap((p) => p.tags))).sort()

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <section className="island-shell rise-in rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <p className="island-kicker mb-3">Blog</p>
        <h1 className="display-title mb-5 max-w-3xl text-4xl leading-[1.02] font-bold tracking-tight text-[var(--sea-ink)] sm:text-6xl">
          {tag ? `Posts tagged "${tag}"` : 'Latest Posts'}
        </h1>

        {tag && (
          <p className="mb-4">
            <Link to="/" className="demo-pill no-underline">
              Clear filter (&times; {tag})
            </Link>
          </p>
        )}

        {allTags.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
            {allTags.map((t) => (
              <Link
                key={t}
                to="/"
                search={{ tag: t }}
                className={`demo-pill no-underline ${t === tag ? 'ring-2 ring-[var(--lagoon-deep)]' : ''}`}
              >
                #{t}
              </Link>
            ))}
          </div>
        )}

        {posts.length === 0 ? (
          <p className="text-[var(--sea-ink-soft)]">No posts found.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {posts.map((post) => (
              <li key={post.slug} className="demo-list-item">
                <h2 className="m-0 mb-1 text-xl font-semibold">
                  <Link
                    to="/posts/$slug"
                    params={{ slug: post.slug }}
                    className="no-underline"
                  >
                    {post.title}
                  </Link>
                </h2>
                {post.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {post.tags.map((t) => (
                      <Link
                        key={t}
                        to="/"
                        search={{ tag: t }}
                        className="demo-pill no-underline"
                      >
                        #{t}
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
