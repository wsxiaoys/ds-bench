export const createComment = async (args, context) => {
  const user = await context.entities.User.findUnique({
    where: { username: args.authorUsername },
  });
  if (!user) {
    throw new Error(`User with username ${args.authorUsername} not found`);
  }

  const comment = await context.entities.Comment.create({
    data: {
      content: args.content,
      postId: args.postId,
      authorId: user.id,
      parentId: args.parentId || null,
    },
  });

  return comment;
};

export const deleteComment = async (args, context) => {
  const deleteRecursive = async (commentId) => {
    const children = await context.entities.Comment.findMany({
      where: { parentId: commentId },
      select: { id: true },
    });
    for (const child of children) {
      await deleteRecursive(child.id);
    }
    await context.entities.Comment.delete({
      where: { id: commentId },
    });
  };

  await deleteRecursive(args.commentId);
};
