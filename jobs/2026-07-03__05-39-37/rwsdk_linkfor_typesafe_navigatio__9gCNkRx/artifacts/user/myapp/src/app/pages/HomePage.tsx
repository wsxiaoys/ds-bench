import { link } from "@/app/shared/links";

export const HomePage = () => {
  return (
    <main>
      <h1>Home</h1>
      <nav>
        <a href={link("/about")}>About</a>
        <br />
        <a href={link("/users/:id", { id: "42" })}>Show user 42</a>
      </nav>
    </main>
  );
};