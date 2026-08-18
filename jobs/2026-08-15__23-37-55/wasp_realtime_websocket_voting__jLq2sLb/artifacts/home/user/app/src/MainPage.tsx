import { useState } from "react";
import { useAuth, logout } from "wasp/client/auth";
import { useNavigate } from "react-router";
import { config } from "wasp/client";
import { getSessionId } from "wasp/client/api";

export function MainPage() {
  const { data: user, isError, isLoading } = useAuth();
  const navigate = useNavigate();

  const [slug, setSlug] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (isLoading) {
    return <div style={{ padding: "20px", textAlign: "center" }}>Loading...</div>;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleAddOption = () => {
    if (options.length < 8) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = [...options];
      newOptions.splice(index, 1);
      setOptions(newOptions);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedSlug = slug.trim();
    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map(o => o.trim()).filter(o => o !== "");

    // Simple client-side validation
    if (!/^[a-z0-9-]{1,32}$/.test(trimmedSlug)) {
      setError("Slug must match ^[a-z0-9-]{1,32}$");
      return;
    }
    if (trimmedQuestion === "") {
      setError("Question must not be empty");
      return;
    }
    if (trimmedOptions.length < 2 || trimmedOptions.length > 8) {
      setError("Options must be between 2 and 8 non-empty strings");
      return;
    }

    try {
      const sessionId = getSessionId();
      const response = await fetch(`${config.apiUrl}/api/polls`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${sessionId}`
        },
        body: JSON.stringify({
          slug: trimmedSlug,
          question: trimmedQuestion,
          options: trimmedOptions
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create poll");
        return;
      }

      setSuccess("Poll created successfully!");
      // Redirect to the poll page
      navigate(`/poll/${trimmedSlug}`);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <h1>PollRoom</h1>
        {user ? (
          <div>
            <span style={{ marginRight: "15px" }}>Logged in as: <strong>{user.identities?.username?.id}</strong></span>
            <button onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <button onClick={() => navigate("/login")}>Login</button>
        )}
      </div>

      {user ? (
        <div>
          <h2>Create a New Poll</h2>
          <form onSubmit={handleCreatePoll} style={{ border: "1px solid #ccc", padding: "20px", borderRadius: "8px", backgroundColor: "#f9f9f9" }}>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. favorite-color"
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                required
              />
              <small style={{ color: "#666" }}>Lowercase letters, numbers, and hyphens only (1-32 chars).</small>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Question</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What is your favorite color?"
                style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                required
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>Options (2 to 8)</label>
              {options.map((option, index) => (
                <div key={index} style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    style={{ flex: 1, padding: "8px", boxSizing: "border-box" }}
                    required
                  />
                  {options.length > 2 && (
                    <button type="button" onClick={() => handleRemoveOption(index)} style={{ backgroundColor: "#ffcdd2", border: "none", padding: "0 10px", cursor: "pointer" }}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {options.length < 8 && (
                <button type="button" onClick={handleAddOption} style={{ marginTop: "5px" }}>
                  + Add Option
                </button>
              )}
            </div>

            {error && <div style={{ color: "red", marginBottom: "15px" }}>{error}</div>}
            {success && <div style={{ color: "green", marginBottom: "15px" }}>{success}</div>}

            <button type="submit" style={{ width: "100%", padding: "12px", backgroundColor: "#4caf50", color: "white", border: "none", borderRadius: "4px", fontSize: "16px", cursor: "pointer" }}>
              Create Poll
            </button>
          </form>
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ fontSize: "18px" }}>Please log in to create or vote on polls.</p>
          <button onClick={() => navigate("/login")} style={{ padding: "10px 20px", fontSize: "16px", cursor: "pointer" }}>
            Go to Login
          </button>
        </div>
      )}
    </div>
  );
}
