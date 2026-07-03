import { link } from "@/app/shared/links";

export const AboutPage = () => {
  return (
    <div>
      <h1>About Page</h1>
      <p>
        <a href={link("/home")}>Back to home</a>
      </p>
    </div>
  );
};
