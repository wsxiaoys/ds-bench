import { Counter } from "./counter.js";

export const Home = ({ ctx }: { ctx: { ZEALT_RUN_ID: string } }) => {
  return <Counter roomId={ctx.ZEALT_RUN_ID} />;
};