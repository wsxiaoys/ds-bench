const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  // Create a user with nested posts in a single operation
  const result = await prisma.user.create({
    data: {
      email: 'nested@example.com',
      name: 'Nested Writer',
      posts: {
        create: [
          { title: 'Nested Post A' },
          { title: 'Nested Post B' }
        ]
      }
    },
    include: { posts: true }
  })

  // Write result to JSON file
  require('fs').writeFileSync(
    '/home/user/myproject/nested_result.json',
    JSON.stringify(result, null, 2)
  )

  console.log('Created user with nested posts:', result)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })