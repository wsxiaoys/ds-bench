import { SQLDatabase } from "encore.dev/storage/sqldb";

// Define the database using its name and migrations directory.
export const recordsDB = new SQLDatabase("records_db", {
  migrations: {
    path: "./migrations",
  },
});
