import { createServerFn } from '@tanstack/react-start'
import {
  getAllPosts,
  getPublishedPosts,
  getPostBySlug,
  createPost,
  updatePost,
  deletePostBySlug
} from './db'

export const getPublishedPostsFn = createServerFn({ method: 'GET' })
  .validator((tag?: string) => tag)
  .handler(async ({ data: tag }) => {
    return getPublishedPosts(tag)
  })

export const getPostFn = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const post = getPostBySlug(slug)
    if (!post || !post.published) {
      const { setResponseStatus } = await import('@tanstack/react-start/server')
      setResponseStatus(404)
      return null
    }
    return post
  })

export const getAllPostsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    return getAllPosts()
  })

export const getAdminPostFn = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    return getPostBySlug(slug)
  })

export const createPostFn = createServerFn({ method: 'POST' })
  .validator((data: { title: string; body: string; tags: string[]; published: boolean }) => data)
  .handler(async ({ data }) => {
    return createPost(data.title, data.body, data.tags, data.published)
  })

export const updatePostFn = createServerFn({ method: 'POST' })
  .validator((data: { id: number; title: string; body: string; tags: string[]; published: boolean }) => data)
  .handler(async ({ data }) => {
    updatePost(data.id, data.title, data.body, data.tags, data.published)
    return { success: true }
  })

export const deletePostFn = createServerFn({ method: 'POST' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    deletePostBySlug(slug)
    return { success: true }
  })
