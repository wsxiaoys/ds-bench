import { env } from "cloudflare:workers";
import { Counter } from "@/app/components/Counter";

export const Home = () => {
  const roomId = (env as any).ZEALT_RUN_ID as string ?? "default";
  return <Counter roomId={roomId} />;
};
