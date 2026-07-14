import React from "react";

export interface HomeProps {
  csrfToken: string;
  messages: string[];
}

export const Home: React.FC<HomeProps> = ({ csrfToken, messages }) => {
  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "sans-serif", padding: "0 20px" }}>
      <h2>Message Board</h2>
      <form action="/submit" method="POST" style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "30px" }}>
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <div>
          <label htmlFor="message" style={{ fontWeight: "bold", display: "block", marginBottom: "5px" }}>Message</label>
          <textarea
            id="message"
            name="message"
            required
            rows={4}
            style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
            placeholder="Type your message here..."
          />
        </div>
        <div>
          <button type="submit" style={{ padding: "10px 20px", cursor: "pointer", background: "#f47238", color: "#fff", border: "none", borderRadius: "4px" }}>
            Submit Message
          </button>
        </div>
      </form>

      <h3>Submitted Messages</h3>
      {messages.length === 0 ? (
        <p style={{ color: "#666" }}>No messages yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {messages.map((msg, index) => (
            <li key={index} style={{ background: "#fff", border: "1px solid #ddd", padding: "10px", marginBottom: "10px", borderRadius: "4px", color: "#333" }}>
              {msg}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
