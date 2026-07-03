// Type Safe Include Payload Helper
//
// Mirrors the intent of Prisma's `Prisma.validator` / `Prisma.UserGetPayload`
// TypeScript utility types: define a reusable, type-safe include configuration
// once and reuse it across queries so the returned shape stays consistent.
//
// In JavaScript we cannot rely on the compiler, so this helper additionally
// validates the returned object shape at runtime.

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// 1. Reusable include configuration (the JS analog of a typed Prisma include).
const userWithPostsArgs = { include: { posts: true } };

// 2. getUserWithPosts reuses the shared include config.
async function getUserWithPosts(email) {
  return prisma.user.findUnique({
    where: { email },
    ...userWithPostsArgs,
  });
}

// 5. Runtime shape validation for the returned payload.
function validateUserWithPostsShape(user) {
  const hasUserKeys =
    user !== null &&
    typeof user === "object" &&
    "id" in user &&
    "email" in user &&
    "name" in user;

  const posts = user && Array.isArray(user.posts) ? user.posts : [];
  const postsHaveTitle = posts.every(
    (post) => post !== null && typeof post === "object" && "title" in post
  );

  return {
    shapeValid: hasUserKeys && postsHaveTitle,
    postCount: posts.length,
  };
}

async function main() {
  // 3. Seed a test user with two posts.
  const email = "shape@example.com";

  // Clean up any previous run so the seed is idempotent.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.post.deleteMany({ where: { authorId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const user = await prisma.user.create({
    data: {
      email,
      name: "Shape",
      posts: {
        create: [{ title: "Shape Post 1" }, { title: "Shape Post 2" }],
      },
    },
  });

  // 4. Fetch the user reusing the shared include config.
  const found = await getUserWithPosts(email);

  // 5. Validate the returned object shape.
  const result = validateUserWithPostsShape(found);

  // 6. Write validation result to payload_result.json.
  const outPath = path.join(__dirname, "payload_result.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n");

  console.log("Validation result:", result);
  console.log("Wrote", outPath);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });