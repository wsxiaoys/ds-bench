export const Home = ({ csrfToken }: { csrfToken: string }) => {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: "600px", margin: "0 auto" }}>
      <h1>Message Board</h1>
      <form action="/submit" method="POST" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <label htmlFor="message" style={{ fontWeight: "bold" }}>Message:</label>
          <input
            type="text"
            id="message"
            name="message"
            required
            style={{ padding: "0.5rem", fontSize: "1rem" }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            backgroundColor: "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Submit
        </button>
      </form>
    </div>
  );
};
