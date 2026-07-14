import type { AppContext } from "@/worker";

export const Home = ({ ctx }: { ctx: AppContext }) => {
  // The CSRF token was generated for this exact request by the
  // `issueCsrfToken` middleware that ran just before this component.
  // The same value was sent back to the browser as a `csrf_token` cookie.
  const csrfToken = ctx.csrfToken ?? "";

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>CSRF-Protected Message Board</h1>

      <p>
        Submitting this form performs a <code>POST /submit</code>. The hidden
        <code> csrf_token</code> field carries the freshly generated token, and
        the same token was set as a <code>csrf_token</code> cookie on this
        response. The server only accepts the submission when the two match
        (double-submit-cookie pattern).
      </p>

      <form method="POST" action="/submit" style={{ display: "grid", gap: "0.5rem", marginTop: "1rem" }}>
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <label htmlFor="message">Message</label>
        <input
          id="message"
          type="text"
          name="message"
          required
          style={{ padding: "0.5rem", fontSize: "1rem" }}
        />
        <button type="submit" style={{ padding: "0.5rem 1rem", fontSize: "1rem" }}>
          Submit
        </button>
      </form>

      <p style={{ marginTop: "1.5rem" }}>
        <a href="/messages">View submitted messages (JSON)</a>
      </p>
    </main>
  );
};