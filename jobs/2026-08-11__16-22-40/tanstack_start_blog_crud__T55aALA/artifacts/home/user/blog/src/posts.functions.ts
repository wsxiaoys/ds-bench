import { createServerFn } from '@tanstack/react-start'

export const getPublishedPostsFn = createServerFn({ method: 'GET' })
  .validator((tag?: string) => tag)
  .handler(async ({ data: tag }) => {
    const { getPublishedPosts } = await import('./db.server');
    return getPublishedPosts(tag);
  });

export const getAllPostsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { getAllPosts } = await import('./db.server');
    return getAllPosts();
  });

export const getPostBySlugFn = createServerFn({ method: 'GET' })
  .validator((data: { slug: string; includeDrafts?: boolean }) => data)
  .handler(async ({ data: { slug, includeDrafts } }) => {
    const { getPostBySlug } = await import('./db.server');
    const post = getPostBySlug(slug);
    if (!post || (!includeDrafts && post.published === 0)) {
      const { setResponseStatus } = await import('@tanstack/react-start/server');
      setResponseStatus(404);
      return null;
    }
    const { marked } = await import('marked');
    const htmlBody = await marked.parse(post.body);
    return {
      ...post,
      htmlBody,
    };
  });

export const createPostFn = createServerFn({ method: 'POST' })
  .validator((data: { title: string; body: string; tags: string[]; published: number }) => data)
  .handler(async ({ data }) => {
    const { createPost } = await import('./db.server');
    return createPost(data);
  });

export const updatePostFn = createServerFn({ method: 'POST' })
  .validator((data: { currentSlug: string; title: string; body: string; tags: string[]; published: number }) => data)
  .handler(async ({ data }) => {
    const { updatePost } = await import('./db.server');
    return updatePost(data.currentSlug, {
      title: data.title,
      body: data.body,
      tags: data.tags,
      published: data.published
    });
  });

export const deletePostFn = createServerFn({ method: 'POST' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const { deletePost } = await import('./db.server');
    return deletePost(slug);
  });
