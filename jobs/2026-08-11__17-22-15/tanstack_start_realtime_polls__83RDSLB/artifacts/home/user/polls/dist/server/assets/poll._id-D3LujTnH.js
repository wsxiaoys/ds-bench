import { jsxs, jsx } from "react/jsx-runtime";
import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { a as Route, g as getPollFn } from "./router-DydLKdYl.js";
import "../server.js";
import "node:async_hooks";
import "h3-v2";
import "@tanstack/router-core";
import "seroval";
import "@tanstack/history";
import "@tanstack/router-core/ssr/client";
import "@tanstack/router-core/ssr/server";
import "@tanstack/react-router/ssr/server";
import "./db-BA0ZmELm.js";
import "sqlite3";
import "sqlite";
import "crypto";
function PollComponent() {
  const initialData = Route.useLoaderData();
  const {
    id
  } = Route.useParams();
  const [poll, setPoll] = useState(initialData.poll);
  const [hasVoted, setHasVoted] = useState(initialData.hasVoted);
  const [voteError, setVoteError] = useState(null);
  useEffect(() => {
    setPoll(initialData.poll);
    setHasVoted(initialData.hasVoted);
  }, [initialData]);
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getPollFn({
          data: id
        });
        if (data && data.poll) {
          setPoll(data.poll);
          setHasVoted(data.hasVoted);
        }
      } catch (err) {
        console.error("Failed to fetch real-time poll updates:", err);
      }
    }, 2e3);
    return () => clearInterval(interval);
  }, [id]);
  const getPercent = (votes, total) => {
    if (total === 0) return 0;
    return Math.round(votes / total * 100);
  };
  const handleVote = async (optionId) => {
    setVoteError(null);
    if (hasVoted) {
      setVoteError("You have already voted on this poll");
      return;
    }
    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          optionId
        })
      });
      const data = await res.json();
      if (res.status === 200) {
        setPoll(data);
        setHasVoted(true);
      } else if (res.status === 409) {
        setVoteError(data.error || "You have already voted on this poll");
        setHasVoted(true);
      } else {
        setVoteError(data.error || "Failed to cast vote");
      }
    } catch (err) {
      setVoteError(err.message || "Network error");
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("div", { style: {
      marginBottom: "20px"
    }, children: /* @__PURE__ */ jsx(Link, { to: "/", style: {
      textDecoration: "none",
      color: "#007bff"
    }, children: "← Back to Polls" }) }),
    /* @__PURE__ */ jsx("h1", { children: poll.question }),
    /* @__PURE__ */ jsxs("div", { "data-testid": "total-votes", style: {
      fontSize: "18px",
      fontWeight: "bold",
      marginBottom: "20px",
      color: "#555"
    }, children: [
      "Total Votes: ",
      poll.totalVotes
    ] }),
    /* @__PURE__ */ jsx("div", { style: {
      display: "flex",
      flexDirection: "column",
      gap: "15px"
    }, children: poll.options.map((option) => {
      const percent = getPercent(option.votes, poll.totalVotes);
      return /* @__PURE__ */ jsxs("div", { style: {
        padding: "15px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        background: "#f9f9f9",
        position: "relative",
        overflow: "hidden"
      }, children: [
        /* @__PURE__ */ jsx("div", { style: {
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: `${percent}%`,
          background: "rgba(40, 167, 69, 0.1)",
          zIndex: 0,
          transition: "width 0.5s ease-in-out"
        } }),
        /* @__PURE__ */ jsxs("div", { style: {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          position: "relative",
          zIndex: 1
        }, children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { style: {
              fontSize: "18px",
              fontWeight: "bold",
              marginRight: "15px"
            }, children: option.text }),
            /* @__PURE__ */ jsx("span", { "data-testid": `count-${option.id}`, style: {
              background: "#eee",
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "14px",
              color: "#666"
            }, children: option.votes })
          ] }),
          /* @__PURE__ */ jsxs("div", { style: {
            display: "flex",
            alignItems: "center",
            gap: "15px"
          }, children: [
            /* @__PURE__ */ jsxs("span", { "data-testid": `percent-${option.id}`, style: {
              fontSize: "18px",
              fontWeight: "bold",
              color: "#28a745"
            }, children: [
              percent,
              "%"
            ] }),
            /* @__PURE__ */ jsx("button", { "data-testid": `vote-${option.id}`, onClick: () => handleVote(option.id), disabled: hasVoted, style: {
              padding: "8px 16px",
              background: hasVoted ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: hasVoted ? "not-allowed" : "pointer",
              fontWeight: "bold"
            }, children: "Vote" })
          ] })
        ] })
      ] }, option.id);
    }) }),
    voteError && /* @__PURE__ */ jsx("div", { "data-testid": "vote-error", style: {
      marginTop: "20px",
      padding: "15px",
      background: "#f8d7da",
      color: "#721c24",
      border: "1px solid #f5c6cb",
      borderRadius: "4px",
      fontWeight: "bold"
    }, children: voteError })
  ] });
}
export {
  PollComponent as component
};
