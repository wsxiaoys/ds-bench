import { SQLDatabase } from "encore.dev/storage/sqldb";

// Define the database for storing monitored sites.
// Encore REDACTEDmatically provisions and manages this PostgreSQL database.
export const siteDB = new SQLDatabase("site-db", {
  migrations: "./migrations",
});

export interface Site {
  id: number;
  url: string;
  is_up: boolean;
}