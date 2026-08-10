import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { getPublishedPostDetail } from '#/server/posts'

export const Route = createFileRoute('/posts/$slug')({
  loader: async ({ params }) => {
    const post = await getPublishedPostDetail({ data: params.slug })
    if (!post) throw notFound()
    return post
  },
  component: PostDetail,
  notFoundComponent: () => (
    <main className="page-wrap px-4 py-14 text-center">
      <h1 className="display-title mb-3 text-4xl font-bold">Not Found</h1>
      <p className="mb-6 text-[var(--sea-ink-soft)]">
        This post could not be found.
      </p>
      <Link to="/" className="demo-button no-underline">
        Back to all posts
      </Link>
    </main>
  ),
})

function PostDetail() {
  const post = Route.useLoaderData()

  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <article className="island-shell rise-in rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14">
        <h1 className="display-title mb-5 text-4xl font-bold tracking-tight text-[var(--sea-ink)] sm:text-5xl">
          {post.title}
        </h1>

        {post.tags.length > 0 && (
          <div className="mb-8 flex flex-wrap gap-2">
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

        <div
          data-testid="post-body"
          className="prose max-w-none"
          dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
        />
      </article>
    </main>
  )
}
