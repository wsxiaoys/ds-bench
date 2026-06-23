import { env } from "cloudflare:workers";
import { Counter } from "./counter";

export const Home = async () => {
  const roomId = (env as any).ZEALT_RUN_ID || "default";
  const namespace = (env as any).SYNCED_STATE_SERVER;
  const id = namespace.idFromName(roomId);
  const stub = namespace.get(id);
  const initialCount = (await stub.getState("count")) ?? 0;

  return <Counter roomId={roomId} initialCount={initialCount} />;
};
