import { link } from "@/app/shared/links";
import { Welcome } from "./welcome.js";

export const Home = () => {
  return (
    <div>
      <Welcome />
      <a href={link("/about")}>About</a>
      <a href={link("/users/:id", { id: "42" })}>Show user 42</a>
    </div>
  );
};
