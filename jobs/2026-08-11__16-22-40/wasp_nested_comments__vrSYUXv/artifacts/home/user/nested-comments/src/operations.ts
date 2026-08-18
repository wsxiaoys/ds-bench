export const getPosts = async (args: any, context: any) => {
  return context.entities.Post.findMany({
    select: {
      id: true,
      title: true,
    },
  })
}

interface CommentNode {
  id: number
  content: string
  authorUsername: string
  parentId: number | null
  children: CommentNode[]
}

export const getCommentTree = async (args: { postId: number }, context: any) => {
  const comments = await context.entities.Comment.findMany({
    where: { postId: args.postId },
    include: {
      author: true,
    },
    orderBy: {
      id: 'asc',
    },
  })

  const nodesMap = new Map<number, CommentNode>()
  const roots: CommentNode[] = []

  // First pass: create all nodes
  for (const comment of comments) {
    const node: CommentNode = {
      id: comment.id,
      content: comment.content,
      authorUsername: comment.author.username,
      parentId: comment.parentId,
      children: [],
    }
    nodesMap.set(comment.id, node)
  }

  // Second pass: link children to parents
  for (const comment of comments) {
    const node = nodesMap.get(comment.id)!
    if (comment.parentId === null || comment.parentId === undefined) {
      roots.push(node)
    } else {
      const parentNode = nodesMap.get(comment.parentId)
      if (parentNode) {
        parentNode.children.push(node)
      } else {
        roots.push(node)
      }
    }
  }

  return roots
}

export const createComment = async (
  args: { postId: number; authorUsername: string; content: string; parentId?: number | null },
  context: any
) => {
  const user = await context.entities.User.findUnique({
    where: { username: args.authorUsername },
  })
  if (!user) {
    throw new Error(`User with username ${args.authorUsername} not found`)
  }

  const post = await context.entities.Post.findUnique({
    where: { id: args.postId },
  })
  if (!post) {
    throw new Error(`Post with id ${args.postId} not found`)
  }

  const comment = await context.entities.Comment.create({
    data: {
      content: args.content,
      postId: args.postId,
      authorId: user.id,
      parentId: args.parentId || null,
    },
  })

  return comment
}

export const deleteComment = async (args: { commentId: number }, context: any) => {
  // Fetch all comments to construct descendant list
  const allComments = await context.entities.Comment.findMany({
    select: { id: true, parentId: true },
  })

  const getDescendantIds = (parentId: number): number[] => {
    const ids: number[] = []
    const children = allComments.filter((c: any) => c.parentId === parentId)
    for (const child of children) {
      ids.push(child.id)
      ids.push(...getDescendantIds(child.id))
    }
    return ids
  }

  const descendantIds = getDescendantIds(args.commentId)

  // Delete descendants first to avoid orphaned replies and foreign key constraint issues
  if (descendantIds.length > 0) {
    await context.entities.Comment.deleteMany({
      where: {
        id: { in: descendantIds },
      },
    })
  }

  // Then delete the target comment
  await context.entities.Comment.delete({
    where: { id: args.commentId },
  })

  return { success: true }
}
