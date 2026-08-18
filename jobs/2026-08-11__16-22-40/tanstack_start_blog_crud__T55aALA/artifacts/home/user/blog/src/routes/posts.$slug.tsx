import { createFileRoute, notFound, Link } from '@tanstack/react-router'
import { getPostBySlugFn } from '../posts.functions'

export const Route = createFileRoute('/posts/$slug')({
  loader: async ({ params: { slug } }) => {
    const post = await getPostBySlugFn({ data: { slug, includeDrafts: false } })
    if (!post) {
      throw notFound()
    }
    return post
  },
  component: PostDetail,
  notFoundComponent: () => {
    return (
      <main className="page-wrap px-4 py-12 text-center max-w-xl mx-auto">
        <h1 className="text-4xl font-bold text-red-600 mb-4">Not Found</h1>
        <p className="text-gray-600 mb-6">The requested post does not exist or is not published.</p>
        <Link to="/" className="text-[var(--lagoon-deep)] hover:underline">
          &larr; Back to home
        </Link>
      </main>
    )
  }
})

function PostDetail() {
  const post = Route.useLoaderData()

  return (
    <main className="page-wrap px-4 pb-8 pt-14 max-w-3xl mx-auto">
      <header className="mb-8">
        <Link to="/" className="text-sm text-[var(--lagoon-deep)] hover:underline mb-4 inline-block">
          &larr; Back to posts
        </Link>
        <h1 className="text-4xl font-bold text-[var(--sea-ink)] mb-4">
          {post.title}
        </h1>
        <div className="flex flex-wrap gap-2 mb-4">
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
      </header>

      <article 
        data-testid="post-body"
        className="prose dark:prose-invert max-w-none island-shell rounded-2xl p-6 md:p-8"
        dangerouslySetInnerHTML={{ __html: post.htmlBody || '' }}
      />
    </main>
  )
}
