import { SQLDatabase } from "encore.dev/storage/sqldb";

// Create the records_db database and assign it to the "recordsDB" variable.
export const recordsDB = new SQLDatabase("records_db", {
  migrations: "./migrations",
});