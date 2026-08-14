import { useQuery, getPosts } from "wasp/client/operations";
import { Link } from "react-router-dom";
import "./Main.css";

export const MainPage = () => {
  const { data: posts, isLoading, error } = useQuery(getPosts);

  if (isLoading) return <div style={{ padding: '20px' }}>Loading posts...</div>;
  if (error) return <div style={{ padding: '20px' }}>Error loading posts: {error.message}</div>;

  return (
    <div className="container" style={{ padding: '20px' }}>
      <main>
        <h2 className="welcome-title" style={{ marginBottom: '20px' }}>Posts</h2>
        <ul style={{ listStyleType: 'none', padding: 0 }}>
          {posts && posts.map((post) => (
            <li key={post.id} style={{ margin: '10px 0' }}>
              <Link to={`/post/${post.id}`} style={{ fontSize: '18px', color: '#ff5e00', textDecoration: 'none', fontWeight: 'bold' }}>
                {post.title}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
};
