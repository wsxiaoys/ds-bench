import { link } from "@/app/shared/links";

export const Home = () => {
  return (
    <div>
      <h1>Home</h1>
      <p>
        <a href={link("/about")}>About</a>
      </p>
      <p>
        <a href={link("/users/:id", { id: "42" })}>Show user 42</a>
      </p>
    </div>
  );
};
