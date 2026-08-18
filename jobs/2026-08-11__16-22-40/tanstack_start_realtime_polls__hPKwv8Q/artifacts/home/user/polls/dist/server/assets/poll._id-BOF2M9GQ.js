import { jsxs, jsx } from "react/jsx-runtime";
import { Link } from "@tanstack/react-router";
import * as React from "react";
import { a as Route } from "./router-DPmgWzod.js";
import "../server.js";
import "node:async_hooks";
import "h3-v2";
import "@tanstack/router-core";
import "seroval";
import "@tanstack/history";
import "@tanstack/router-core/ssr/client";
import "@tanstack/router-core/ssr/server";
import "@tanstack/react-router/ssr/server";
import "./db-BgzlcB5H.js";
import "node:sqlite";
import "node:crypto";
function PollComponent() {
  const {
    initialPoll,
    pollId
  } = Route.useLoaderData();
  const [poll, setPoll] = React.useState(initialPoll);
  const [voteError, setVoteError] = React.useState(null);
  const [isVoting, setIsSubmitting] = React.useState(false);
  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/polls/${pollId}`);
        if (response.ok) {
          const updatedPoll = await response.json();
          setPoll(updatedPoll);
        }
      } catch (err) {
        console.error("Failed to fetch live updates", err);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [pollId]);
  if (!poll) {
    return /* @__PURE__ */ jsxs("div", { style: {
      textAlign: "center",
      padding: "3rem 1rem"
    }, children: [
      /* @__PURE__ */ jsx("h1", { style: {
        color: "#e53e3e"
      }, children: "Poll Not Found" }),
      /* @__PURE__ */ jsx("p", { style: {
        color: "#718096",
        marginBottom: "2rem"
      }, children: "The poll you are looking for does not exist or has been deleted." }),
      /* @__PURE__ */ jsx(Link, { to: "/", style: {
        padding: "0.75rem 1.5rem",
        background: "#3182ce",
        color: "white",
        textDecoration: "none",
        borderRadius: "4px",
        fontWeight: "bold"
      }, children: "Go Back Home" })
    ] });
  }
  const handleVote = async (optionId) => {
    setVoteError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          optionId
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setVoteError(data.error || "Failed to cast vote");
        setIsSubmitting(false);
        return;
      }
      setPoll(data);
    } catch (err) {
      setVoteError(err.message || "An error occurred while voting");
    } finally {
      setIsSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("div", { style: {
      marginBottom: "1.5rem"
    }, children: /* @__PURE__ */ jsx(Link, { to: "/", style: {
      color: "#3182ce",
      textDecoration: "none",
      fontWeight: "bold"
    }, children: "← Back to All Polls" }) }),
    /* @__PURE__ */ jsxs("div", { style: {
      background: "white",
      border: "1px solid #e2e8f0",
      padding: "2rem",
      borderRadius: "8px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
    }, children: [
      /* @__PURE__ */ jsx("h1", { style: {
        marginTop: 0,
        marginBottom: "1.5rem",
        color: "#2d3748",
        fontSize: "1.8rem"
      }, children: poll.question }),
      voteError && /* @__PURE__ */ jsx("div", { "data-testid": "vote-error", style: {
        color: "#e53e3e",
        background: "#fff5f5",
        padding: "1rem",
        borderRadius: "6px",
        marginBottom: "1.5rem",
        border: "1px solid #fed7d7",
        fontWeight: "bold"
      }, children: voteError }),
      /* @__PURE__ */ jsxs("div", { style: {
        marginBottom: "2rem",
        color: "#4a5568",
        fontSize: "1.1rem",
        fontWeight: "bold"
      }, children: [
        "Total Votes:",
        " ",
        /* @__PURE__ */ jsx("span", { "data-testid": "total-votes", style: {
          fontSize: "1.25rem",
          color: "#2d3748"
        }, children: poll.totalVotes })
      ] }),
      /* @__PURE__ */ jsx("div", { style: {
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem"
      }, children: poll.options.map((option) => {
        const percentage = poll.totalVotes === 0 ? 0 : Math.round(option.votes / poll.totalVotes * 100);
        return /* @__PURE__ */ jsxs("div", { style: {
          border: "1px solid #edf2f7",
          borderRadius: "8px",
          padding: "1rem 1.5rem",
          background: "#f7fafc",
          position: "relative",
          overflow: "hidden"
        }, children: [
          /* @__PURE__ */ jsx("div", { style: {
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: `${percentage}%`,
            background: "#ebf8ff",
            zIndex: 0,
            transition: "width 0.5s ease-out"
          } }),
          /* @__PURE__ */ jsxs("div", { style: {
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "1rem"
          }, children: [
            /* @__PURE__ */ jsxs("div", { style: {
              flex: 1,
              minWidth: "200px"
            }, children: [
              /* @__PURE__ */ jsx("div", { style: {
                fontWeight: "600",
                fontSize: "1.1rem",
                color: "#2d3748",
                marginBottom: "0.25rem"
              }, children: option.text }),
              /* @__PURE__ */ jsxs("div", { style: {
                fontSize: "0.9rem",
                color: "#718096"
              }, children: [
                /* @__PURE__ */ jsx("span", { "data-testid": `count-${option.id}`, style: {
                  fontWeight: "bold",
                  color: "#4a5568"
                }, children: option.votes }),
                " ",
                option.votes === 1 ? "vote" : "votes"
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { style: {
              display: "flex",
              alignItems: "center",
              gap: "1.5rem"
            }, children: [
              /* @__PURE__ */ jsxs("span", { "data-testid": `percent-${option.id}`, style: {
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "#2b6cb0",
                minWidth: "70px",
                textAlign: "right"
              }, children: [
                percentage,
                "%"
              ] }),
              /* @__PURE__ */ jsx("button", { "data-testid": `vote-${option.id}`, onClick: () => handleVote(option.id), disabled: isVoting, style: {
                padding: "0.6rem 1.2rem",
                fontSize: "1rem",
                background: "#3182ce",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: isVoting ? "not-allowed" : "pointer",
                fontWeight: "bold",
                transition: "background-color 0.2s",
                boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
              }, onMouseOver: (e) => {
                if (!isVoting) e.currentTarget.style.background = "#2b6cb0";
              }, onMouseOut: (e) => {
                if (!isVoting) e.currentTarget.style.background = "#3182ce";
              }, children: "Vote" })
            ] })
          ] })
        ] }, option.id);
      }) })
    ] })
  ] });
}
export {
  PollComponent as component
};
