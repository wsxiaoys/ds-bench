interface HomePageProps {
  csrfToken: string;
}

export const HomePage = ({ csrfToken }: HomePageProps) => {
  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: "600px", margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Message Board</h1>

      <section>
        <h2>Post a Message</h2>
        <form method="POST" action="/submit">
          <input type="hidden" name="csrf_token" value={csrfToken} />
          <div style={{ marginBottom: "0.75rem" }}>
            <label htmlFor="message" style={{ display: "block", marginBottom: "0.25rem" }}>
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              style={{ width: "100%", boxSizing: "border-box" }}
              required
            />
          </div>
          <button type="submit">Send</button>
        </form>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>All Messages</h2>
        <p>
          View all persisted messages at{" "}
          <a href="/messages">/messages</a>.
        </p>
      </section>
    </main>
  );
};

// Keep a default export alias so any existing imports don't break
export const Home = () => <HomePage csrfToken="" />;
