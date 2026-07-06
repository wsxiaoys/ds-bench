import { SQLDatabase } from "encore.dev/storage/sqldb";

// Create the sites database and assign it to the "db" variable.
export const db = new SQLDatabase("monitor", {
  migrations: "./migrations",
});