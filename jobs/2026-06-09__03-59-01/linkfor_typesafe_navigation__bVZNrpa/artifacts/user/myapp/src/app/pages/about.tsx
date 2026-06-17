import { link } from "@/app/shared/links";

export const About = () => {
  return (
    <div>
      <h1>About</h1>
      <p>
        <a href={link("/home")}>Back to home</a>
      </p>
    </div>
  );
};
