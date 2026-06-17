# Init Schema And Migrate

You are working in the directory `/home/user/myproject`. The project has Node.js initialized and Prisma ORM installed with a SQLite datasource. The file `prisma/schema.prisma` already exists and is configured to use SQLite, but it contains no models yet.

Your job:
1. Open `prisma/schema.prisma` and add a `User` model with the following fields:
   - `id`: Int, primary key, auto-incremented
   - `email`: String, unique
   - `name`: String, optional
2. Run the initial migration using the command:
   `npx prisma migrate dev --name init`

Do not change the datasource or generator blocks. Only add the model. Make sure the migration completes successfully and the SQLite database file is created.
