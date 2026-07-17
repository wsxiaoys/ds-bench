/**
 * Idempotent seed function runnable via `wasp db seed devSeed`.
 *
 * Creates users `alice` and `bob` and a post titled `Wasp Nested Comments`.
 * Running it more than once does not create duplicates (uses upsert).
 */
export const devSeed = async (prisma) => {
  // Upsert users by their unique username.
  const alice = await prisma.user.upsert({
    where: { username: 'alice' },
    update: {},
    create: { username: 'alice' },
  });

  const bob = await prisma.user.upsert({
    where: { username: 'bob' },
    update: {},
    create: { username: 'bob' },
  });

  // Upsert the post by its title.
  // Since there is no unique constraint on title, we use findFirst + create
  // to keep the seed idempotent.
  let post = await prisma.post.findFirst({
    where: { title: 'Wasp Nested Comments' },
  });

  if (!post) {
    post = await prisma.post.create({
      data: { title: 'Wasp Nested Comments' },
    });
  }

  console.log('Seeded users:', alice.username, bob.username);
  console.log('Seeded post:', post.id, post.title);
};