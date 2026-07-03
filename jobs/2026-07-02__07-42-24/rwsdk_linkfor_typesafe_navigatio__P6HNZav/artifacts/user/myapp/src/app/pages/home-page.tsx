import { link } from "@/app/shared/links";

export const HomePage = () => {
  return (
    <div>
      <h1>Home Page</h1>
      <p>
        <a href={link("/about")}>About</a>
      </p>
      <p>
        <a href={link("/users/:id", { id: "42" })}>Show user 42</a>
      </p>
    </div>
  );
};
