import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "../../db/schema";
import { LikeButton } from "./LikeButton";

export const Home = async () => {
  const db = drizzle(env.DB, { schema });
  const result = await db.select().from(schema.likes).execute();
  const count = result[0]?.count ?? 0;

  return <LikeButton initialCount={count} />;
};
