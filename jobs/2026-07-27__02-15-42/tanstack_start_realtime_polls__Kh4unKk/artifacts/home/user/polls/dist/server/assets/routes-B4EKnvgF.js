import { t as Route } from "./routes-_K5Z6BYs.js";
import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/index.tsx?tsr-split=component
function HomeComponent() {
	const polls = Route.useLoaderData();
	const navigate = useNavigate();
	const [question, setQuestion] = useState("");
	const [options, setOptions] = useState(["", ""]);
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
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
		setLoading(true);
		try {
			const res = await fetch("/api/polls", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					question,
					options: options.filter((opt) => opt.trim() !== "")
				})
			});
			const data = await res.json();
			if (!res.ok) {
				setError(data.error || "Failed to create poll");
				setLoading(false);
				return;
			}
			navigate({
				to: "/poll/$id",
				params: { id: data.id }
			});
		} catch (err) {
			setError(err.message || "An error occurred");
			setLoading(false);
		}
	};
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
		className: "card",
		children: [
			/* @__PURE__ */ jsx("h2", { children: "Create a New Poll" }),
			error && /* @__PURE__ */ jsx("div", {
				className: "error",
				children: error
			}),
			/* @__PURE__ */ jsxs("form", {
				onSubmit: handleSubmit,
				children: [
					/* @__PURE__ */ jsxs("div", {
						style: { marginBottom: "1rem" },
						children: [/* @__PURE__ */ jsx("label", {
							style: {
								display: "block",
								fontWeight: "bold",
								marginBottom: "0.5rem"
							},
							children: "Question:"
						}), /* @__PURE__ */ jsx("input", {
							type: "text",
							value: question,
							onChange: (e) => setQuestion(e.target.value),
							placeholder: "What is your favorite programming language?",
							style: {
								width: "100%",
								padding: "0.5rem",
								borderRadius: "0.375rem",
								border: "1px solid #d1d5db",
								boxSizing: "border-box"
							},
							required: true
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						style: { marginBottom: "1rem" },
						children: [
							/* @__PURE__ */ jsx("label", {
								style: {
									display: "block",
									fontWeight: "bold",
									marginBottom: "0.5rem"
								},
								children: "Options:"
							}),
							options.map((option, index) => /* @__PURE__ */ jsxs("div", {
								style: {
									display: "flex",
									gap: "0.5rem",
									marginBottom: "0.5rem"
								},
								children: [/* @__PURE__ */ jsx("input", {
									type: "text",
									value: option,
									onChange: (e) => handleOptionChange(index, e.target.value),
									placeholder: `Option ${index + 1}`,
									style: {
										flex: 1,
										padding: "0.5rem",
										borderRadius: "0.375rem",
										border: "1px solid #d1d5db",
										boxSizing: "border-box"
									},
									required: index < 2
								}), options.length > 2 && /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => removeOption(index),
									className: "btn btn-secondary",
									style: { padding: "0.5rem" },
									children: "Remove"
								})]
							}, index)),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: addOption,
								className: "btn btn-secondary",
								style: { marginTop: "0.5rem" },
								children: "+ Add Option"
							})
						]
					}),
					/* @__PURE__ */ jsx("button", {
						type: "submit",
						className: "btn",
						disabled: loading,
						children: loading ? "Creating..." : "Create Poll"
					})
				]
			})
		]
	}), /* @__PURE__ */ jsxs("div", {
		className: "card",
		children: [/* @__PURE__ */ jsx("h2", { children: "Active Polls" }), polls.length === 0 ? /* @__PURE__ */ jsx("p", {
			style: { color: "#6b7280" },
			children: "No active polls yet. Create one above!"
		}) : /* @__PURE__ */ jsx("ul", {
			style: {
				listStyle: "none",
				padding: 0,
				margin: 0
			},
			children: polls.map((poll) => /* @__PURE__ */ jsxs("li", {
				style: {
					padding: "1rem 0",
					borderBottom: "1px solid #e5e7eb",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center"
				},
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
					style: { margin: "0 0 0.25rem 0" },
					children: /* @__PURE__ */ jsx(Link, {
						to: "/poll/$id",
						params: { id: poll.id },
						style: {
							color: "#2563eb",
							textDecoration: "none"
						},
						children: poll.question
					})
				}), /* @__PURE__ */ jsxs("span", {
					style: {
						fontSize: "0.875rem",
						color: "#6b7280"
					},
					children: [
						poll.totalVotes,
						" ",
						poll.totalVotes === 1 ? "vote" : "votes"
					]
				})] }), /* @__PURE__ */ jsx(Link, {
					to: "/poll/$id",
					params: { id: poll.id },
					className: "btn btn-secondary",
					style: { textDecoration: "none" },
					children: "View Poll"
				})]
			}, poll.id))
		})]
	})] });
}
//#endregion
export { HomeComponent as component };
