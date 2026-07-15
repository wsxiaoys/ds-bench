/**
 * Idempotent dev seed: creates two users (`alice` and `bob`) and a
 * single post titled `Wasp Nested Comments`. Running the seed more
 * than once MUST NOT create duplicates — we use `upsert` for each
 * record.
 *
 * Run with: `wasp db seed devSeed`
 */
export const devSeed = async (prismaClient) => {
  // Create (or keep) the two users.
  const alice = await prismaClient.user.upsert({
    where: { username: "alice" },
    update: {},
    create: {
      username: "alice",
    },
  });

  const bob = await prismaClient.user.upsert({
    where: { username: "bob" },
    update: {},
    create: {
      username: "bob",
    },
  });

  // Create (or keep) the post titled "Wasp Nested Comments".
  // We look up an existing post by title and only create it if it's
  // missing — this keeps the seed idempotent without requiring a
  // unique constraint on `title`.
  const existingPost = await prismaClient.post.findFirst({
    where: { title: "Wasp Nested Comments" },
  });

  if (!existingPost) {
    await prismaClient.post.create({
      data: {
        title: "Wasp Nested Comments",
        authorId: alice.id,
      },
    });
  }

  // Touch the variables so eslint/static analysis doesn't complain.
  void bob;
};
