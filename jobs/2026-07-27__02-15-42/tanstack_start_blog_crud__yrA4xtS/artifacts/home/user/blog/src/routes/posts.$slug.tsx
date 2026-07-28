import { createFileRoute, notFound } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getPostBySlug } from '../posts'

const setStatusCode404 = createIsomorphicFn()
  .server(async () => {
    const { setResponseStatus } = await import('@tanstack/react-start/server')
    setResponseStatus(404)
  })
  .client(() => {})

export const Route = createFileRoute('/posts/$slug')({
  loader: async ({ params: { slug } }) => {
    const post = await getPostBySlug({ data: slug })
    if (!post || !post.published) {
      await setStatusCode404()
      throw notFound()
    }
    
    const { marked } = await import('marked')
    const htmlBody = await marked.parse(post.body)
    return { post, htmlBody }
  },
  component: PostDetail,
  notFoundComponent: PostNotFound,
})

function PostDetail() {
  const { post, htmlBody } = Route.useLoaderData()

  return (
    <main className="page-wrap px-4 pb-8 pt-14 max-w-3xl mx-auto">
      <article className="island-shell rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <header className="mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-[var(--sea-ink)] mb-4">
            {post.title}
          </h1>
          
          <div className="flex flex-wrap gap-2">
            {post.tags.map((t: string) => (
              <a
                key={t}
                href={`/?tag=${encodeURIComponent(t)}`}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full text-xs font-semibold transition"
              >
                #{t}
              </a>
            ))}
          </div>
        </header>

        <div
          data-testid="post-body"
          className="prose prose-stone max-w-none text-[var(--sea-ink)]"
          dangerouslySetInnerHTML={{ __html: htmlBody }}
        />

        <div className="mt-12 pt-6 border-t border-gray-200">
          <a
            href="/"
            className="text-sm font-semibold text-[var(--lagoon-deep)] hover:underline"
          >
            ← Back to Home
          </a>
        </div>
      </article>
    </main>
  )
}

function PostNotFound() {
  return (
    <main className="page-wrap px-4 pb-8 pt-14 max-w-md mx-auto text-center">
      <div className="island-shell rounded-2xl p-8">
        <h1 className="text-3xl font-bold text-red-600 mb-4">Not Found</h1>
        <p className="text-gray-600 mb-6">
          The requested post does not exist or is not published yet.
        </p>
        <a
          href="/"
          className="rounded-full bg-[var(--lagoon-deep)] text-white px-6 py-2 text-sm font-semibold hover:opacity-90 transition"
        >
          Go Back Home
        </a>
      </div>
    </main>
  )
}
