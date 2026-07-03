import { link } from "@/app/shared/links";

export const AboutPage = () => {
  return (
    <main>
      <h1>About</h1>
      <a href={link("/home")}>Back to home</a>
    </main>
  );
};