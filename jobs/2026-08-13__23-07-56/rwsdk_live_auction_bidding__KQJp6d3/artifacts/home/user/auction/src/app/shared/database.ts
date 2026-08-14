import { SqliteDurableObject } from "rwsdk/db";

export interface DatabaseSchema {
  auctions: {
    itemId: string;
    winningBidder: string;
    winningAmount: number;
    closed: number; // 0 or 1
  };
}

export class DatabaseServer extends SqliteDurableObject<DatabaseSchema> {
  constructor(state: any, env: any) {
    const migrations = {
      "2026-08-13-init": {
        async up(db: any) {
          await db.schema
            .createTable("auctions")
            .ifNotExists()
            .addColumn("itemId", "text", (col: any) => col.primaryKey())
            .addColumn("winningBidder", "text")
            .addColumn("winningAmount", "integer")
            .addColumn("closed", "integer")
            .execute();
        },
        async down(db: any) {
          await db.schema.dropTable("auctions").execute();
        }
      }
    };
    super(state, env, migrations);
  }
}
