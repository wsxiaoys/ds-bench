interface CommentNode {
  id: number;
  content: string;
  authorUsername: string;
  parentId: number | null;
  children: CommentNode[];
}

export const getPosts = async (args: any, context: any) => {
  return context.entities.Post.findMany({
    select: {
      id: true,
      title: true,
    },
  });
};

export const getCommentTree = async (args: { postId: number }, context: any) => {
  const comments = await context.entities.Comment.findMany({
    where: { postId: args.postId },
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

  // Create nodes map
  const nodesMap: Record<number, CommentNode> = {};
  for (const comment of comments) {
    nodesMap[comment.id] = {
      id: comment.id,
      content: comment.content,
      authorUsername: comment.author.username,
      parentId: comment.parentId,
      children: [],
    };
  }

  const rootNodes: CommentNode[] = [];
  // Build parent-child relationships
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

  // Ensure sibling nodes are ordered by ascending id
  const sortTree = (nodes: CommentNode[]) => {
    nodes.sort((a, b) => a.id - b.id);
    for (const node of nodes) {
      sortTree(node.children);
    }
  };
  sortTree(rootNodes);

  return rootNodes;
};
