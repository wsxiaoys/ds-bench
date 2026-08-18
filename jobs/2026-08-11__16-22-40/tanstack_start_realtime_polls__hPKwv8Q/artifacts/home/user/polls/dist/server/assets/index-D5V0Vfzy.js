import { jsxs, jsx } from "react/jsx-runtime";
import { useNavigate, Link } from "@tanstack/react-router";
import * as React from "react";
import { R as Route } from "./router-DPmgWzod.js";
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
function HomeComponent() {
  const {
    polls
  } = Route.useLoaderData();
  const navigate = useNavigate();
  const [question, setQuestion] = React.useState("");
  const [options, setOptions] = React.useState(["", ""]);
  const [error, setError] = React.useState(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };
  const addOption = () => {
    setOptions([...options, ""]);
  };
  const removeOption = (index) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/polls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question,
          options
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to create poll");
        setIsSubmitting(false);
        return;
      }
      navigate({
        to: `/poll/${data.id}`
      });
    } catch (err) {
      setError(err.message || "An error occurred");
      setIsSubmitting(false);
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { style: {
      marginBottom: "2rem",
      textAlign: "center"
    }, children: "Real-Time Polling App" }),
    /* @__PURE__ */ jsxs("section", { style: {
      background: "#f9f9f9",
      padding: "1.5rem",
      borderRadius: "8px",
      marginBottom: "2rem",
      border: "1px solid #e2e8f0"
    }, children: [
      /* @__PURE__ */ jsx("h2", { style: {
        marginTop: 0,
        marginBottom: "1.5rem"
      }, children: "Create a New Poll" }),
      error && /* @__PURE__ */ jsx("div", { style: {
        color: "#e53e3e",
        background: "#fff5f5",
        padding: "0.75rem",
        borderRadius: "4px",
        marginBottom: "1rem",
        border: "1px solid #fed7d7"
      }, children: error }),
      /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
        /* @__PURE__ */ jsxs("div", { style: {
          marginBottom: "1rem"
        }, children: [
          /* @__PURE__ */ jsx("label", { htmlFor: "question", style: {
            display: "block",
            fontWeight: "bold",
            marginBottom: "0.5rem"
          }, children: "Poll Question" }),
          /* @__PURE__ */ jsx("input", { id: "question", type: "text", value: question, onChange: (e) => setQuestion(e.target.value), placeholder: "What is your favorite programming language?", style: {
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            borderRadius: "4px",
            border: "1px solid #cbd5e0",
            boxSizing: "border-box"
          }, required: true })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: {
          marginBottom: "1rem"
        }, children: [
          /* @__PURE__ */ jsx("label", { style: {
            display: "block",
            fontWeight: "bold",
            marginBottom: "0.5rem"
          }, children: "Options (At least 2)" }),
          options.map((option, index) => /* @__PURE__ */ jsxs("div", { style: {
            display: "flex",
            gap: "0.5rem",
            marginBottom: "0.5rem"
          }, children: [
            /* @__PURE__ */ jsx("input", { type: "text", value: option, onChange: (e) => handleOptionChange(index, e.target.value), placeholder: `Option ${index + 1}`, style: {
              flex: 1,
              padding: "0.75rem",
              fontSize: "1rem",
              borderRadius: "4px",
              border: "1px solid #cbd5e0",
              boxSizing: "border-box"
            }, required: true }),
            options.length > 2 && /* @__PURE__ */ jsx("button", { type: "button", onClick: () => removeOption(index), style: {
              padding: "0 1rem",
              background: "#e53e3e",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "1rem"
            }, children: "Remove" })
          ] }, index)),
          /* @__PURE__ */ jsx("button", { type: "button", onClick: addOption, style: {
            marginTop: "0.5rem",
            padding: "0.5rem 1rem",
            background: "#3182ce",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "0.9rem"
          }, children: "+ Add Option" })
        ] }),
        /* @__PURE__ */ jsx("button", { type: "submit", disabled: isSubmitting, style: {
          width: "100%",
          padding: "0.75rem",
          fontSize: "1rem",
          background: "#48bb78",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold"
        }, children: isSubmitting ? "Creating..." : "Create Poll" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("section", { children: [
      /* @__PURE__ */ jsx("h2", { children: "Existing Polls" }),
      polls.length === 0 ? /* @__PURE__ */ jsx("p", { style: {
        color: "#718096",
        fontStyle: "italic"
      }, children: "No polls created yet. Be the first to create one!" }) : /* @__PURE__ */ jsx("div", { style: {
        display: "flex",
        flexDirection: "column",
        gap: "1rem"
      }, children: polls.map((poll) => /* @__PURE__ */ jsxs(Link, { to: `/poll/${poll.id}`, style: {
        display: "block",
        textDecoration: "none",
        color: "inherit",
        background: "white",
        border: "1px solid #e2e8f0",
        padding: "1.5rem",
        borderRadius: "8px",
        transition: "box-shadow 0.2s, border-color 0.2s",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
      }, onMouseOver: (e) => {
        e.currentTarget.style.borderColor = "#cbd5e0";
        e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.1)";
      }, onMouseOut: (e) => {
        e.currentTarget.style.borderColor = "#e2e8f0";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
      }, children: [
        /* @__PURE__ */ jsx("h3", { style: {
          margin: "0 0 0.5rem 0",
          color: "#2d3748"
        }, children: poll.question }),
        /* @__PURE__ */ jsxs("div", { style: {
          color: "#718096",
          fontSize: "0.9rem"
        }, children: [
          poll.totalVotes,
          " ",
          poll.totalVotes === 1 ? "vote" : "votes",
          " • ",
          poll.options.length,
          " options"
        ] })
      ] }, poll.id)) })
    ] })
  ] });
}
export {
  HomeComponent as component
};
