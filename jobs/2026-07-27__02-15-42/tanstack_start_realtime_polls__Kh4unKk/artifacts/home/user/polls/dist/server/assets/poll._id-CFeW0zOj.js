import { t as Route } from "./poll._id-DQ1Rt90H.js";
import { useEffect, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/poll.$id.tsx?tsr-split=component
function PollComponent() {
	const [poll, setPoll] = useState(Route.useLoaderData());
	const [voteError, setVoteError] = useState(null);
	const [votingId, setVotingId] = useState(null);
	useEffect(() => {
		const interval = setInterval(async () => {
			try {
				const res = await fetch(`/api/polls/${poll.id}`);
				if (res.ok) {
					const data = await res.json();
					setPoll(data);
				}
			} catch (err) {
				console.error("Failed to fetch updated poll", err);
			}
		}, 1e3);
		return () => clearInterval(interval);
	}, [poll.id]);
	const handleVote = async (optionId) => {
		setVoteError(null);
		setVotingId(optionId);
		try {
			const res = await fetch(`/api/polls/${poll.id}/vote`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ optionId })
			});
			const data = await res.json();
			if (!res.ok) {
				setVoteError(data.error || "Failed to cast vote");
				return;
			}
			setPoll(data);
		} catch (err) {
			setVoteError(err.message || "An error occurred while voting");
		} finally {
			setVotingId(null);
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "card",
		children: [
			/* @__PURE__ */ jsx("h2", {
				style: { marginBottom: "1.5rem" },
				children: poll.question
			}),
			voteError && /* @__PURE__ */ jsx("div", {
				"data-testid": "vote-error",
				className: "error",
				style: { marginBottom: "1.5rem" },
				children: voteError
			}),
			/* @__PURE__ */ jsx("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: "1rem",
					marginBottom: "2rem"
				},
				children: poll.options.map((option) => {
					const percent = poll.totalVotes === 0 ? 0 : Math.round(option.votes / poll.totalVotes * 100);
					return /* @__PURE__ */ jsxs("div", {
						style: {
							border: "1px solid #e5e7eb",
							borderRadius: "0.5rem",
							padding: "1rem",
							backgroundColor: "#f9fafb",
							position: "relative",
							overflow: "hidden"
						},
						children: [/* @__PURE__ */ jsx("div", { style: {
							position: "absolute",
							top: 0,
							left: 0,
							bottom: 0,
							width: `${percent}%`,
							backgroundColor: "#dbeafe",
							zIndex: 1,
							transition: "width 0.5s ease-out-in"
						} }), /* @__PURE__ */ jsxs("div", {
							style: {
								position: "relative",
								zIndex: 2,
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center"
							},
							children: [/* @__PURE__ */ jsxs("div", {
								style: {
									display: "flex",
									alignItems: "center",
									gap: "1rem",
									flex: 1
								},
								children: [/* @__PURE__ */ jsx("button", {
									"data-testid": `vote-${option.id}`,
									onClick: () => handleVote(option.id),
									disabled: votingId !== null,
									className: "btn",
									style: {
										padding: "0.375rem 0.75rem",
										fontSize: "0.875rem"
									},
									children: votingId === option.id ? "Voting..." : "Vote"
								}), /* @__PURE__ */ jsx("span", {
									style: { fontWeight: 500 },
									children: option.text
								})]
							}), /* @__PURE__ */ jsxs("div", {
								style: {
									display: "flex",
									alignItems: "center",
									gap: "1.5rem"
								},
								children: [/* @__PURE__ */ jsx("span", {
									"data-testid": `count-${option.id}`,
									style: {
										fontWeight: "bold",
										minWidth: "3rem",
										textAlign: "right"
									},
									children: option.votes
								}), /* @__PURE__ */ jsxs("span", {
									"data-testid": `percent-${option.id}`,
									style: {
										fontWeight: "bold",
										color: "#2563eb",
										minWidth: "3.5rem",
										textAlign: "right"
									},
									children: [percent, "%"]
								})]
							})]
						})]
					}, option.id);
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				style: {
					borderTop: "1px solid #e5e7eb",
					paddingTop: "1rem",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					color: "#4b5563"
				},
				children: [/* @__PURE__ */ jsxs("span", { children: ["Total Votes: ", /* @__PURE__ */ jsx("strong", {
					"data-testid": "total-votes",
					children: poll.totalVotes
				})] }), /* @__PURE__ */ jsx("a", {
					href: "/",
					style: {
						color: "#2563eb",
						textDecoration: "none",
						fontWeight: 500
					},
					children: "← Back to All Polls"
				})]
			})
		]
	});
}
//#endregion
export { PollComponent as component };
