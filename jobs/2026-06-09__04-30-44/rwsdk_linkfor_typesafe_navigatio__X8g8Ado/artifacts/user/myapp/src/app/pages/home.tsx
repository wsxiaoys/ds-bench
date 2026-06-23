import { link } from "../shared/links";

export const Home = () => {
  return (
    <div>
      <a href={link("/about")}>About</a>
      <a href={link("/users/:id", { id: "42" })}>Show user 42</a>
    </div>
  );
};
