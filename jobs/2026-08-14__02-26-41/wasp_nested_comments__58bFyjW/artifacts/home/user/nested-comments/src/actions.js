export const createComment = async ({ postId, authorUsername, content, parentId }, context) => {
  const user = await context.entities.User.findUnique({
    where: { username: authorUsername },
  });
  if (!user) {
    throw new Error(`User with username "${authorUsername}" not found`);
  }

  const newComment = await context.entities.Comment.create({
    data: {
      content,
      postId: Number(postId),
      authorId: user.id,
      parentId: parentId ? Number(parentId) : null,
    },
  });

  return newComment;
};

const deleteCommentAndDescendants = async (commentId, context) => {
  const children = await context.entities.Comment.findMany({
    where: { parentId: commentId },
    select: { id: true },
  });
  for (const child of children) {
    await deleteCommentAndDescendants(child.id, context);
  }
  await context.entities.Comment.delete({
    where: { id: commentId },
  });
};

export const deleteComment = async ({ commentId }, context) => {
  await deleteCommentAndDescendants(Number(commentId), context);
};
