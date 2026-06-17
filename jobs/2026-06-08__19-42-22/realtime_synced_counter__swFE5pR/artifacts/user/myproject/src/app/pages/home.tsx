import { Counter } from "./Counter.js";
import { env } from "cloudflare:workers";

export const Home = () => {
  const roomId = (env.ZEALT_RUN_ID as string) || "default";

  return (
    <main>
      <Counter roomId={roomId} />
    </main>
  );
};
