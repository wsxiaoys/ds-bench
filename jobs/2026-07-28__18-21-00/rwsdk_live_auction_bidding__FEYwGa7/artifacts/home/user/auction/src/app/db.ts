import { SqliteDurableObject, createDb } from "rwsdk/db";
import { env } from "cloudflare:workers";

export interface Database {
  auction_results: {
    item_id: string;
    winner_name: string;
    winning_amount: number;
    closed: number;
  };
}

export const migrations = {
  "001_create_auction_results": {
    async up(db: any) {
      await db.schema
        .createTable("auction_results")
        .addColumn("item_id", "text", (col: any) => col.primaryKey())
        .addColumn("winner_name", "text", (col: any) => col.notNull())
        .addColumn("winning_amount", "integer", (col: any) => col.notNull())
        .addColumn("closed", "integer", (col: any) => col.notNull().defaultTo(1))
        .execute();
    },
    async down(db: any) {
      await db.schema.dropTable("auction_results").execute();
    }
  }
};

export class DbServer extends SqliteDurableObject {
  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env, migrations);
  }
}

export const getDb = () => {
  if (!env.DB_SERVER) {
    throw new Error("DB_SERVER binding is missing");
  }
  return createDb<Database>(env.DB_SERVER);
};

export async function saveAuctionResult(itemId: string, winnerName: string, winningAmount: number) {
  const db = getDb();
  const existing = await db
    .selectFrom("auction_results")
    .selectAll()
    .where("item_id", "=", itemId)
    .executeTakeFirst();

  if (existing) {
    await db
      .updateTable("auction_results")
      .set({
        winner_name: winnerName || "No one",
        winning_amount: winningAmount,
        closed: 1,
      })
      .where("item_id", "=", itemId)
      .execute();
  } else {
    await db
      .insertInto("auction_results")
      .values({
        item_id: itemId,
        winner_name: winnerName || "No one",
        winning_amount: winningAmount,
        closed: 1,
      })
      .execute();
  }
}

export async function getAuctionResult(itemId: string) {
  try {
    const db = getDb();
    const result = await db
      .selectFrom("auction_results")
      .selectAll()
      .where("item_id", "=", itemId)
      .executeTakeFirst();
    return result;
  } catch (e) {
    console.error("Error reading from DB:", e);
    return undefined;
  }
}
