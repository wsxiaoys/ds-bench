import { Welcome } from "./welcome.js";

export const Home = () => {
  return (
    <div>
      <nav style={{
        padding: "1rem",
        backgroundColor: "#f4f4f5",
        borderBottom: "1px solid #e4e4e7",
        display: "flex",
        gap: "1rem",
        justifyContent: "center"
      }}>
        <a href="/" style={{ color: "#2563eb", textDecoration: "none", fontWeight: "bold" }}>Home</a>
        <a href="/login" style={{ color: "#2563eb", textDecoration: "none", fontWeight: "bold" }}>Login</a>
        <a href="/dashboard" style={{ color: "#2563eb", textDecoration: "none", fontWeight: "bold" }}>Dashboard</a>
      </nav>
      <Welcome />
    </div>
  );
};
