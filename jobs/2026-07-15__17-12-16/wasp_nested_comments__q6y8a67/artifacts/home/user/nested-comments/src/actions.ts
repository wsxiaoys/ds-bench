interface CreateCommentArgs {
  postId: number;
  authorUsername: string;
  content: string;
  parentId?: number | null;
}

interface DeleteCommentArgs {
  commentId: number;
}

export const createComment = async (
  args: CreateCommentArgs,
  context: { entities: { Comment: any; User: any; Post: any } }
) => {
  const { postId, authorUsername, content, parentId } = args;

  const author = await context.entities.User.findUnique({
    where: { username: authorUsername }
  });
  if (!author) {
    throw new Error(`User with username ${authorUsername} not found`);
  }

  const post = await context.entities.Post.findUnique({
    where: { id: postId }
  });
  if (!post) {
    throw new Error(`Post with id ${postId} not found`);
  }

  const newComment = await context.entities.Comment.create({
    data: {
      content,
      postId,
      authorId: author.id,
      parentId: parentId || null
    }
  });

  return newComment;
};

export const deleteComment = async (
  args: DeleteCommentArgs,
  context: { entities: { Comment: any } }
) => {
  const { commentId } = args;

  const comment = await context.entities.Comment.findUnique({
    where: { id: commentId }
  });

  if (comment) {
    await context.entities.Comment.delete({
      where: { id: commentId }
    });
  }

  return { success: true };
};
