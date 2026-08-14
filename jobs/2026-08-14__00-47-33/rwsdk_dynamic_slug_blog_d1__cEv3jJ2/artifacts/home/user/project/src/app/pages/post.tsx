import React from "react";

interface PostPageProps {
  title: string;
  content: string;
}

export const PostPage: React.FC<PostPageProps> = ({ title, content }) => {
  return (
    <article style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <header style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>{title}</h1>
        <p><a href="/blog" style={{ textDecoration: "none", color: "#0070f3" }}>&larr; Back to Blog</a></p>
      </header>
      <div style={{ fontSize: "1.1rem", lineHeight: "1.6", color: "#333" }}>
        {content}
      </div>
    </article>
  );
};
