export const getPosts = async (args, context) => {
  return context.entities.Post.findMany({
    select: {
      id: true,
      title: true,
    },
  });
};

export const getCommentTree = async (args, context) => {
  const comments = await context.entities.Comment.findMany({
    where: { postId: args.postId },
    include: {
      author: true,
    },
    orderBy: {
      id: 'asc',
    },
  });

  const nodesMap = {};
  for (const comment of comments) {
    nodesMap[comment.id] = {
      id: comment.id,
      content: comment.content,
      authorUsername: comment.author.username,
      parentId: comment.parentId,
      children: [],
    };
  }

  const rootNodes = [];
  for (const comment of comments) {
    const node = nodesMap[comment.id];
    if (comment.parentId === null) {
      rootNodes.push(node);
    } else {
      const parentNode = nodesMap[comment.parentId];
      if (parentNode) {
        parentNode.children.push(node);
      }
    }
  }

  return rootNodes;
};
