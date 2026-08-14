import { SqliteDurableObject } from "rwsdk/db";

export interface Database {
  auctions: {
    itemId: string;
    winningBidder: string | null;
    winningAmount: number;
    closed: number; // 0 or 1
  };
}

const migrations = {
  "0001_create_auctions": {
    async up(db: any) {
      await db.schema
        .createTable("auctions")
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

export class AuctionDb extends SqliteDurableObject<Database> {
  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env, migrations);
  }
}
