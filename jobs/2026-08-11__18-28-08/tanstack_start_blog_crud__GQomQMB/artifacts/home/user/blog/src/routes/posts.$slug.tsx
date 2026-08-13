import { createFileRoute, notFound } from '@tanstack/react-router'
import { getPostBySlugFn } from '../serverFunctions'
import { marked } from 'marked'

export const Route = createFileRoute('/posts/$slug')({
  loader: async ({ params: { slug } }) => {
    const post = await getPostBySlugFn({ data: slug })
    if (!post || !post.published) {
      throw notFound()
    }
    return post
  },
  notFoundComponent: () => {
    return (
      <main className="page-wrap px-4 py-12">
        <section className="island-shell rounded-2xl p-6 sm:p-8 text-center">
          <h1 className="text-4xl font-bold text-[var(--sea-ink)] mb-4">Not Found</h1>
          <p className="text-[var(--sea-ink-soft)]">The post you are looking for does not exist or is a draft.</p>
        </section>
      </main>
    )
  },
  component: PostDetail,
})

function PostComponent() {
  const post = Route.useLoaderData()
  const htmlBody = marked.parseSync(post.body) as string

  return (
    <main className="page-wrap px-4 py-12">
      <article className="island-shell rounded-2xl p-6 sm:p-8">
        <header className="mb-8 border-b border-[var(--line)] pb-6">
          <h1 className="text-4xl font-bold text-[var(--sea-ink)] mb-3">{post.title}</h1>
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags.map((tag) => (
              <a
                key={tag}
                href={`/?tag=${encodeURIComponent(tag)}`}
                className="rounded-full bg-[var(--chip-bg)] border border-[var(--chip-line)] px-3 py-1 text-xs font-semibold text-[var(--lagoon-deep)] transition hover:bg-[rgba(79,184,178,0.24)]"
              >
                #{tag}
              </a>
            ))}
          </div>
        </header>
        <div
          data-testid="post-body"
          className="prose max-w-none text-[var(--sea-ink-soft)] leading-relaxed space-y-4"
          dangerouslySetInnerHTML={{ __html: htmlBody }}
        />
      </article>
    </main>
  )
}

function PostDetail() {
  return <PostComponent />
}
