const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

const userWithPostsArgs = { include: { posts: true } };

async function getUserWithPosts(email) {
  return prisma.user.findUnique({
    where: { email },
    ...userWithPostsArgs,
  });
}

function validateUserShape(user) {
  const hasBaseKeys =
    user &&
    typeof user === "object" &&
    Object.prototype.hasOwnProperty.call(user, "id") &&
    Object.prototype.hasOwnProperty.call(user, "email") &&
    Object.prototype.hasOwnProperty.call(user, "name");

  const posts = user && Array.isArray(user.posts) ? user.posts : null;
  const postsHaveTitles =
    posts?.every(
      (post) =>
        post &&
        typeof post === "object" &&
        Object.prototype.hasOwnProperty.call(post, "title")
    ) ?? false;

  return {
    shapeValid: Boolean(hasBaseKeys && posts && posts.length === 2 && postsHaveTitles),
    postCount: posts ? posts.length : 0,
  };
}

async function main() {
  const email = "shape@example.com";

  await prisma.post.deleteMany({
    where: {
      author: {
        email,
      },
    },
  });
  await prisma.user.deleteMany({ where: { email } });

  await prisma.user.create({
    data: {
      email,
      name: "Shape",
      posts: {
        create: [{ title: "Shape Post 1" }, { title: "Shape Post 2" }],
      },
    },
  });

  const user = await getUserWithPosts(email);
  const validationResult = validateUserShape(user);
  const outputPath = path.join(__dirname, "payload_result.json");
  fs.writeFileSync(outputPath, JSON.stringify(validationResult, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

module.exports = {
  getUserWithPosts,
  userWithPostsArgs,
};
