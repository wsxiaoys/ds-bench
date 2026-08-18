import { PrismaClient } from '@prisma/client'

export const devSeed = async (prisma: PrismaClient) => {
  // Create users idempotently
  await prisma.user.upsert({
    where: { username: 'alice' },
    update: {},
    create: { username: 'alice' }
  });

  await prisma.user.upsert({
    where: { username: 'bob' },
    update: {},
    create: { username: 'bob' }
  });

  // Create post idempotently
  const existingPost = await prisma.post.findFirst({
    where: { title: 'Wasp Nested Comments' }
  });

  if (!existingPost) {
    await prisma.post.create({
      data: { title: 'Wasp Nested Comments' }
    });
  }
}
