import { jsxs, jsx } from "react/jsx-runtime";
import { useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { R as Route, c as createPollFn } from "./router-DydLKdYl.js";
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
function HomeComponent() {
  const polls = Route.useLoaderData();
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [error, setError] = useState(null);
  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };
  const addOptionField = () => {
    setOptions([...options, ""]);
  };
  const removeOptionField = (index) => {
    if (options.length <= 2) return;
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map((o) => o.trim()).filter((o) => o !== "");
    if (!trimmedQuestion) {
      setError("Question is required");
      return;
    }
    if (trimmedOptions.length < 2) {
      setError("At least 2 non-empty options are required");
      return;
    }
    try {
      const newPoll = await createPollFn({
        data: {
          question: trimmedQuestion,
          options: trimmedOptions
        }
      });
      setQuestion("");
      setOptions(["", ""]);
      await router.invalidate();
      window.location.href = `/poll/${newPoll.id}`;
    } catch (err) {
      setError(err.message || "Failed to create poll");
    }
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("h1", { children: "Real-Time Polling App" }),
    /* @__PURE__ */ jsxs("div", { style: {
      marginBottom: "40px",
      padding: "20px",
      border: "1px solid #ccc",
      borderRadius: "8px"
    }, children: [
      /* @__PURE__ */ jsx("h2", { children: "Create a New Poll" }),
      error && /* @__PURE__ */ jsx("div", { style: {
        color: "red",
        marginBottom: "10px"
      }, children: error }),
      /* @__PURE__ */ jsxs("form", { onSubmit: handleSubmit, children: [
        /* @__PURE__ */ jsxs("div", { style: {
          marginBottom: "15px"
        }, children: [
          /* @__PURE__ */ jsx("label", { style: {
            display: "block",
            fontWeight: "bold",
            marginBottom: "5px"
          }, children: "Question:" }),
          /* @__PURE__ */ jsx("input", { type: "text", value: question, onChange: (e) => setQuestion(e.target.value), placeholder: "What is your favorite programming language?", style: {
            width: "100%",
            padding: "8px",
            boxSizing: "border-box"
          }, required: true })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: {
          marginBottom: "15px"
        }, children: [
          /* @__PURE__ */ jsx("label", { style: {
            display: "block",
            fontWeight: "bold",
            marginBottom: "5px"
          }, children: "Options:" }),
          options.map((option, index) => /* @__PURE__ */ jsxs("div", { style: {
            display: "flex",
            marginBottom: "10px"
          }, children: [
            /* @__PURE__ */ jsx("input", { type: "text", value: option, onChange: (e) => handleOptionChange(index, e.target.value), placeholder: `Option ${index + 1}`, style: {
              flex: 1,
              padding: "8px"
            }, required: index < 2 }),
            options.length > 2 && /* @__PURE__ */ jsx("button", { type: "button", onClick: () => removeOptionField(index), style: {
              marginLeft: "10px",
              padding: "8px 12px",
              background: "#ff4d4d",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer"
            }, children: "Remove" })
          ] }, index)),
          /* @__PURE__ */ jsx("button", { type: "button", onClick: addOptionField, style: {
            padding: "8px 12px",
            background: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }, children: "+ Add Option" })
        ] }),
        /* @__PURE__ */ jsx("button", { type: "submit", style: {
          padding: "10px 20px",
          background: "#28a745",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "16px"
        }, children: "Create Poll" })
      ] })
    ] }),
    /* @__PURE__ */ jsx("h2", { children: "Existing Polls" }),
    polls.length === 0 ? /* @__PURE__ */ jsx("p", { children: "No polls created yet. Be the first to create one!" }) : /* @__PURE__ */ jsx("ul", { style: {
      listStyleType: "none",
      padding: 0
    }, children: polls.map((poll) => /* @__PURE__ */ jsxs("li", { style: {
      padding: "15px",
      border: "1px solid #eee",
      marginBottom: "10px",
      borderRadius: "4px"
    }, children: [
      /* @__PURE__ */ jsx(Link, { to: `/poll/${poll.id}`, style: {
        textDecoration: "none",
        color: "#007bff",
        fontSize: "18px",
        fontWeight: "bold"
      }, children: poll.question }),
      /* @__PURE__ */ jsxs("div", { style: {
        color: "#666",
        marginTop: "5px"
      }, children: [
        "Total Votes: ",
        poll.totalVotes
      ] })
    ] }, poll.id)) })
  ] });
}
export {
  HomeComponent as component
};
