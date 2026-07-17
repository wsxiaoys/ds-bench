// Idempotent dev seed: creates users `alice` and `bob`, and a post titled
// "Wasp Nested Comments". Safe to run more than once (uses upsert / findFirst
// checks so it never creates duplicates).
export const devSeed = async (prismaClient) => {
  const alice = await prismaClient.user.upsert({
    where: { username: "alice" },
    update: {},
    create: { username: "alice" },
  });

  const bob = await prismaClient.user.upsert({
    where: { username: "bob" },
    update: {},
    create: { username: "bob" },
  });

  const postTitle = "Wasp Nested Comments";
  let post = await prismaClient.post.findFirst({
    where: { title: postTitle },
  });
  if (!post) {
    post = await prismaClient.post.create({
      data: { title: postTitle },
    });
  }

  console.log("Seed complete:", {
    alice: alice.id,
    bob: bob.id,
    post: post.id,
  });
};
