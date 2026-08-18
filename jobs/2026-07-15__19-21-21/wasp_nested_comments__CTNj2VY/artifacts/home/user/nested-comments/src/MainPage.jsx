import { Link } from "react-router-dom";
import { useQuery, getPosts } from "wasp/client/operations";
import waspLogo from "./waspLogo.png";
import "./Main.css";

export const MainPage = () => {
  const { data: posts, isLoading, error } = useQuery(getPosts);

  return (
    <div className="container">
      <main>
        <div className="logo">
          <img src={waspLogo} alt="wasp" />
        </div>

        <h2 className="welcome-title">Threaded Comments Demo</h2>

        {isLoading && <p>Loading posts...</p>}
        {error && <p>Error: {error.message}</p>}

        <ul style={{ listStyle: "none", padding: 0 }}>
          {(posts ?? []).map((post) => (
            <li key={post.id}>
              <Link to={`/post/${post.id}`}>{post.title}</Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
};
