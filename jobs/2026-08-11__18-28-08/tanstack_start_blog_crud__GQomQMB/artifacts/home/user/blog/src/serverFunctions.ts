import { createServerFn } from '@tanstack/react-start'

export function parseTags(tagsString: string): string[] {
  return tagsString
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0);
}

export const getPostsFn = createServerFn({ method: 'GET' })
  .validator((d: { admin?: boolean; tag?: string } | undefined) => d)
  .handler(async ({ data }) => {
    const { getPosts, getPublishedPosts } = await import('./db')
    const admin = data?.admin ?? false;
    const tag = data?.tag;
    
    let posts = admin ? getPosts() : getPublishedPosts();
    
    if (tag) {
      posts = posts.filter(post => post.tags.includes(tag));
    }
    
    return posts;
  })

export const getPostBySlugFn = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const { getPostBySlug } = await import('./db')
    const post = getPostBySlug(slug)
    if (!post || !post.published) {
      const { setResponseStatus } = await import('@tanstack/react-start/server')
      setResponseStatus(404)
    }
    return post
  })

export const createPostFn = createServerFn({ method: 'POST' })
  .validator((data: { title: string; body: string; tags: string; published: boolean }) => data)
  .handler(async ({ data }) => {
    const { createPost } = await import('./db')
    const parsedTags = parseTags(data.tags);
    return createPost({
      title: data.title,
      body: data.body,
      tags: parsedTags,
      published: data.published,
    });
  })

export const updatePostFn = createServerFn({ method: 'POST' })
  .validator((data: { id: number; title: string; body: string; tags: string; published: boolean }) => data)
  .handler(async ({ data }) => {
    const { updatePost } = await import('./db')
    const parsedTags = parseTags(data.tags);
    updatePost(data.id, {
      title: data.title,
      body: data.body,
      tags: parsedTags,
      published: data.published,
    });
    return { success: true };
  })

export const deletePostFn = createServerFn({ method: 'POST' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const { deletePost } = await import('./db')
    deletePost(slug);
    return { success: true };
  })
