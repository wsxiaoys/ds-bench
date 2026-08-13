import { createFileRoute, notFound, Link } from '@tanstack/react-router'
import { getPostFn } from '../serverFunctions'
import { marked } from 'marked'

export const Route = createFileRoute('/posts/$slug')({
  loader: async ({ params }) => {
    const post = await getPostFn({ data: params.slug })
    if (!post) {
      throw notFound()
    }
    // Render markdown to HTML
    const renderedBody = marked.parse(post.body)
    return { post, renderedBody }
  },
  component: PostDetail,
  notFoundComponent: () => {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8 text-center">
          <h1 className="text-4xl font-bold text-[var(--sea-ink)] mb-4">Not Found</h1>
          <p className="text-base text-[var(--sea-ink-soft)] mb-6">
            The post you are looking for does not exist or is a draft.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(23,58,64,0.2)] bg-white/50 px-5 py-2.5 text-sm font-semibold text-[var(--sea-ink)] no-underline transition hover:-translate-y-0.5 hover:bg-white"
          >
            Back to Home
          </Link>
        </section>
      </main>
    )
  }
})

function PostDetail() {
  const { post, renderedBody } = Route.useLoaderData()

  return (
    <main className="page-wrap px-4 pb-8 pt-10">
      <article className="island-shell rounded-[2rem] px-6 py-10 sm:px-10 sm:py-12 max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            to="/"
            className="text-sm font-semibold text-[var(--lagoon-deep)] hover:underline no-underline"
          >
            &larr; Back to all posts
          </Link>
        </div>

        <header className="mb-8 border-b border-[var(--line)] pb-6">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--sea-ink)] mb-4">
            {post.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--sea-ink-soft)]">
            <span>
              Published on{' '}
              {new Date(post.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </span>
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.tags.map(t => (
                  <Link
                    key={t}
                    to="/"
                    search={{ tag: t }}
                    className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-0.5 text-xs font-semibold text-[var(--sea-ink)] no-underline hover:bg-[var(--link-bg-hover)] transition"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* The Markdown body, rendered to HTML, MUST be placed inside an element carrying the attribute data-testid="post-body" */}
        <section
          data-testid="post-body"
          className="prose prose-stone dark:prose-invert max-w-none text-base leading-relaxed text-[var(--sea-ink)]"
          dangerouslySetInnerHTML={{ __html: renderedBody }}
        />
      </article>
    </main>
  )
}
