export const getPosts = async (args, context) => {
  return context.entities.Post.findMany({
    select: {
      id: true,
      title: true,
    },
    orderBy: {
      id: 'asc',
    },
  });
};

export const getCommentTree = async ({ postId }, context) => {
  const comments = await context.entities.Comment.findMany({
    where: { postId: Number(postId) },
    include: {
      author: {
        select: {
          username: true,
        },
      },
    },
    orderBy: {
      id: 'asc',
    },
  });

  const nodesMap = {};
  const rootNodes = [];

  for (const comment of comments) {
    nodesMap[comment.id] = {
      id: comment.id,
      content: comment.content,
      authorUsername: comment.author.username,
      parentId: comment.parentId,
      children: [],
    };
  }

  for (const comment of comments) {
    const node = nodesMap[comment.id];
    if (comment.parentId === null || comment.parentId === undefined) {
      rootNodes.push(node);
    } else {
      const parentNode = nodesMap[comment.parentId];
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }
  }

  return rootNodes;
};
