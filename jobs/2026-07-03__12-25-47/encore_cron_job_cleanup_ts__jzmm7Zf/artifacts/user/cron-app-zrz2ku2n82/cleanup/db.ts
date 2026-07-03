import { SQLDatabase } from "encore.dev/storage/sqldb";

export const recordsDB = new SQLDatabase("records_db", {
  migrations: "./migrations",
});
