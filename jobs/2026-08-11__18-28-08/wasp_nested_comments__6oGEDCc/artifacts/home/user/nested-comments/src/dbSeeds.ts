export const devSeed = async (prisma: any) => {
  // Idempotently create users with usernames 'alice' and 'bob'
  const usernames = ['alice', 'bob'];
  for (const username of usernames) {
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });
    if (!existingUser) {
      await prisma.user.create({
        data: { username },
      });
    }
  }

  // Idempotently create a post titled 'Wasp Nested Comments'
  const postTitle = 'Wasp Nested Comments';
  const existingPost = await prisma.post.findFirst({
    where: { title: postTitle },
  });
  if (!existingPost) {
    await prisma.post.create({
      data: { title: postTitle },
    });
  }
};
