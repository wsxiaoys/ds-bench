import { useState } from "react";
import { useAuth, logout } from "wasp/client/auth";
import { api } from "wasp/client/api";
import { useNavigate } from "react-router";

export function MainPage() {
  const { data: user } = useAuth();
  const navigate = useNavigate();

  const [slug, setSlug] = useState("");
  const [question, setQuestion] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [goSlug, setGoSlug] = useState("");

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const options = optionsText
      .split(",")
      .map((opt) => opt.trim())
      .filter((opt) => opt !== "");

    try {
      const response = await api.post("api/polls", {
        json: {
          slug,
          question,
          options,
        },
      });

      if (response.ok) {
        const data: any = await response.json();
        setSuccess(`Poll created successfully! Redirecting...`);
        setTimeout(() => {
          navigate(`/poll/${data.slug}`);
        }, 1500);
      } else {
        const errData: any = await response.json();
        setError(errData.error || "Failed to create poll.");
      }
    } catch (err: any) {
      if (err.response) {
        try {
          const errData = await err.response.json();
          setError(errData.error || "Failed to create poll.");
        } catch {
          setError("Failed to create poll.");
        }
      } else {
        setError(err.message || "An unexpected error occurred.");
      }
    }
  };

  const handleGoToPoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (goSlug.trim()) {
      navigate(`/poll/${goSlug.trim()}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const username = user?.identities?.username?.id || "";

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <h2>PollRoom Dashboard</h2>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span>Welcome, <strong>{username}</strong>!</span>
            <button
              onClick={handleLogout}
              style={{ padding: "5px 10px", background: "#dc3545", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              Log Out
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gap: "30px" }}>
        {/* Create Poll Section */}
        <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px", background: "#f8f9fa" }}>
          <h3>Create a New Poll</h3>
          <form onSubmit={handleCreatePoll}>
            <div style={{ marginBottom: "15px" }}>
              <label htmlFor="poll-slug" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Slug</label>
              <input
                id="poll-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. best-framework"
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                required
              />
              <small style={{ color: "#666" }}>Only lowercase letters, numbers, and hyphens (1-32 chars).</small>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label htmlFor="poll-question" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Question</label>
              <input
                id="poll-question"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What is your favorite framework?"
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                required
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label htmlFor="poll-options" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Options (comma-separated)</label>
              <input
                id="poll-options"
                type="text"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="Wasp, Next.js, Remix, SvelteKit"
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                required
              />
              <small style={{ color: "#666" }}>Enter 2 to 8 unique options separated by commas.</small>
            </div>

            {error && <div style={{ color: "red", marginBottom: "15px" }}>Error: {error}</div>}
            {success && <div style={{ color: "green", marginBottom: "15px" }}>{success}</div>}

            <button
              type="submit"
              style={{ width: "100%", padding: "10px", background: "#28a745", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}
            >
              Create Poll
            </button>
          </form>
        </div>

        {/* Go to Poll Section */}
        <div style={{ padding: "20px", border: "1px solid #ccc", borderRadius: "8px" }}>
          <h3>Go to Existing Poll</h3>
          <form onSubmit={handleGoToPoll} style={{ display: "flex", gap: "10px" }}>
            <input
              type="text"
              value={goSlug}
              onChange={(e) => setGoSlug(e.target.value)}
              placeholder="Enter poll slug"
              style={{ flex: 1, padding: "8px", boxSizing: "border-box" }}
              required
            />
            <button
              type="submit"
              style={{ padding: "8px 15px", background: "#007bff", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
            >
              Go
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
