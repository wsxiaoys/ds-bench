import { createServerFn } from '@tanstack/react-start'
import {
  createPost as dbCreatePost,
  deletePost as dbDeletePost,
  getPostBySlug,
  getPublishedPostBySlug,
  listAllPosts,
  listPublishedPosts,
  parseTags,
  updatePost as dbUpdatePost,
} from './db'
import { renderMarkdown } from './markdown'
import type { Post } from './db'

export type { Post }

export interface PostWithHtml extends Post {
  bodyHtml: string
}

function withHtml(post: Post): PostWithHtml {
  return { ...post, bodyHtml: renderMarkdown(post.body) }
}

export const getPublishedPostsList = createServerFn({ method: 'GET' })
  .validator((data: { tag?: string } | undefined) => data ?? {})
  .handler(async ({ data }) => {
    return listPublishedPosts(data.tag)
  })

export const getAllPostsList = createServerFn({ method: 'GET' }).handler(
  async () => {
    return listAllPosts()
  },
)

export const getPublishedPostDetail = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const post = getPublishedPostBySlug(slug)
    return post ? withHtml(post) : null
  },
  )

export const getPostForEdit = createServerFn({ method: 'GET' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const post = getPostBySlug(slug)
    return post ?? null
  })

export interface PostFormInput {
  title: string
  body: string
  tags: string
  published: boolean
}

export const createPostFn = createServerFn({ method: 'POST' })
  .validator((data: PostFormInput) => data)
  .handler(async ({ data }) => {
    const post = dbCreatePost({
      title: data.title,
      body: data.body,
      tags: parseTags(data.tags),
      published: data.published,
    })
    return post
  })

export const updatePostFn = createServerFn({ method: 'POST' })
  .validator((data: { slug: string } & PostFormInput) => data)
  .handler(async ({ data }) => {
    const post = dbUpdatePost(data.slug, {
      title: data.title,
      body: data.body,
      tags: parseTags(data.tags),
      published: data.published,
    })
    return post ?? null
  })

export const deletePostFn = createServerFn({ method: 'POST' })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    return dbDeletePost(slug)
  })
