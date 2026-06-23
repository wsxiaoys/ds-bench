import { link } from "@/app/shared/links";

export const About = () => {
  return (
    <div>
      <h1>About</h1>
      <a href={link("/home")}>Back to home</a>
    </div>
  );
};
