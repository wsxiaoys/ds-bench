export const createComment = async (
  args: { postId: number; authorUsername: string; content: string; parentId?: number | null },
  context: any
) => {
  const { postId, authorUsername, content, parentId } = args;

  // Look up user by username
  const user = await context.entities.User.findUnique({
    where: { username: authorUsername },
  });
  if (!user) {
    throw new Error(`User with username '${authorUsername}' not found`);
  }

  // Create the comment
  const comment = await context.entities.Comment.create({
    data: {
      content,
      postId,
      userId: user.id,
      parentId: parentId || null,
    },
  });

  return comment;
};

export const deleteComment = async (
  args: { commentId: number },
  context: any
) => {
  const { commentId } = args;

  // Recursive deletion of descendants first, then the comment itself
  const deleteRecursive = async (id: number) => {
    const children = await context.entities.Comment.findMany({
      where: { parentId: id },
      select: { id: true },
    });
    for (const child of children) {
      await deleteRecursive(child.id);
    }
    await context.entities.Comment.delete({
      where: { id },
    });
  };

  await deleteRecursive(commentId);
};
