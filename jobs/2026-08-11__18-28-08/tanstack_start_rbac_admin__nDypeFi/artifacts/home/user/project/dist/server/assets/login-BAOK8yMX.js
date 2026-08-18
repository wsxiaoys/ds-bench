import { r as loginFn } from "./server-functions-B2Mv98Du.js";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/login.tsx?tsr-split=component
function LoginComponent() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState(null);
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();
	const handleSubmit = async (e) => {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			if ((await loginFn({ data: {
				email,
				password
			} })).role === "admin") navigate({ to: "/admin" });
			else setError("Access denied: You are not an admin.");
		} catch (err) {
			setError(err.message || "Invalid credentials");
		} finally {
			setLoading(false);
		}
	};
	return /* @__PURE__ */ jsx("div", {
		style: {
			display: "flex",
			flex: 1,
			alignItems: "center",
			justifyContent: "center",
			padding: "1rem"
		},
		children: /* @__PURE__ */ jsxs("div", {
			style: {
				maxWidth: "400px",
				width: "100%",
				padding: "2rem",
				backgroundColor: "#ffffff",
				borderRadius: "8px",
				boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)"
			},
			children: [
				/* @__PURE__ */ jsx("h2", {
					style: {
						fontSize: "1.5rem",
						fontWeight: "bold",
						marginBottom: "1.5rem",
						textAlign: "center"
					},
					children: "Sign In"
				}),
				error && /* @__PURE__ */ jsx("div", {
					style: {
						padding: "0.75rem",
						backgroundColor: "#fef2f2",
						color: "#b91c1c",
						borderRadius: "4px",
						marginBottom: "1rem",
						fontSize: "0.875rem"
					},
					children: error
				}),
				/* @__PURE__ */ jsxs("form", {
					onSubmit: handleSubmit,
					style: {
						display: "flex",
						flexDirection: "column",
						gap: "1rem"
					},
					children: [
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
							htmlFor: "email",
							style: {
								display: "block",
								fontSize: "0.875rem",
								fontWeight: "medium",
								marginBottom: "0.25rem"
							},
							children: "Email Address"
						}), /* @__PURE__ */ jsx("input", {
							id: "email",
							type: "email",
							value: email,
							onChange: (e) => setEmail(e.target.value),
							required: true,
							placeholder: "root@example.com",
							style: {
								width: "100%",
								padding: "0.5rem",
								borderRadius: "4px",
								border: "1px solid #d1d5db",
								boxSizing: "border-box"
							}
						})] }),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
							htmlFor: "password",
							style: {
								display: "block",
								fontSize: "0.875rem",
								fontWeight: "medium",
								marginBottom: "0.25rem"
							},
							children: "Password"
						}), /* @__PURE__ */ jsx("input", {
							id: "password",
							type: "password",
							value: password,
							onChange: (e) => setPassword(e.target.value),
							required: true,
							placeholder: "••••••••",
							style: {
								width: "100%",
								padding: "0.5rem",
								borderRadius: "4px",
								border: "1px solid #d1d5db",
								boxSizing: "border-box"
							}
						})] }),
						/* @__PURE__ */ jsx("button", {
							type: "submit",
							disabled: loading,
							style: {
								width: "100%",
								padding: "0.75rem",
								backgroundColor: loading ? "#9ca3af" : "#2563eb",
								color: "#ffffff",
								border: "none",
								borderRadius: "4px",
								fontWeight: "bold",
								cursor: loading ? "not-allowed" : "pointer",
								marginTop: "0.5rem"
							},
							children: loading ? "Signing in..." : "Sign In"
						})
					]
				})
			]
		})
	});
}
//#endregion
export { LoginComponent as component };
