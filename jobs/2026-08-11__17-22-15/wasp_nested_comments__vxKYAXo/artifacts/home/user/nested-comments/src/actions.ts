interface CreateCommentArgs {
  postId: number;
  authorUsername: string;
  content: string;
  parentId?: number | null;
}

interface DeleteCommentArgs {
  commentId: number;
}

export const createComment = async (args: CreateCommentArgs, context: any) => {
  const postId = typeof args.postId === 'string' ? parseInt(args.postId, 10) : args.postId;
  const parentId = args.parentId !== undefined && args.parentId !== null
    ? (typeof args.parentId === 'string' ? parseInt(args.parentId, 10) : args.parentId)
    : null;

  const user = await context.entities.User.findUnique({
    where: { username: args.authorUsername }
  });

  if (!user) {
    throw new Error(`User with username ${args.authorUsername} not found`);
  }

  const comment = await context.entities.Comment.create({
    data: {
      content: args.content,
      postId,
      authorId: user.id,
      parentId
    }
  });

  return comment;
};

export const deleteComment = async (args: DeleteCommentArgs, context: any) => {
  const commentId = typeof args.commentId === 'string' ? parseInt(args.commentId, 10) : args.commentId;

  // Find the comment first
  const comment = await context.entities.Comment.findUnique({
    where: { id: commentId }
  });

  if (!comment) {
    return { success: false, message: 'Comment not found' };
  }

  // Fetch all comments for this post to build the deletion tree
  const allComments = await context.entities.Comment.findMany({
    where: { postId: comment.postId }
  });

  // Map of parentId -> list of child comment IDs
  const parentToChildrenMap = new Map<number, number[]>();
  for (const c of allComments) {
    if (c.parentId !== null) {
      if (!parentToChildrenMap.has(c.parentId)) {
        parentToChildrenMap.set(c.parentId, []);
      }
      parentToChildrenMap.get(c.parentId)!.push(c.id);
    }
  }

  // Collect all descendant IDs recursively
  const idsToDelete: number[] = [commentId];
  const collectDescendants = (id: number) => {
    const children = parentToChildrenMap.get(id) || [];
    for (const childId of children) {
      idsToDelete.push(childId);
      collectDescendants(childId);
    }
  };
  collectDescendants(commentId);

  // Delete all collected comments
  await context.entities.Comment.deleteMany({
    where: {
      id: { in: idsToDelete }
    }
  });

  return { success: true, deletedCount: idsToDelete.length };
};
