import { r as loginFn } from "./server-fns-qrxJ0EdC.js";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/login.tsx?tsr-split=component
function LoginComponent() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const navigate = useNavigate();
	const handleSubmit = async (e) => {
		e.preventDefault();
		setError("");
		setLoading(true);
		try {
			if ((await loginFn({ data: {
				email,
				password
			} })).role === "admin") navigate({ to: "/admin" });
			else navigate({ to: "/" });
		} catch (err) {
			setError("Invalid credentials");
		} finally {
			setLoading(false);
		}
	};
	return /* @__PURE__ */ jsx("div", {
		style: {
			display: "flex",
			justifyContent: "center",
			alignItems: "center",
			minHeight: "100vh"
		},
		children: /* @__PURE__ */ jsxs("div", {
			style: {
				background: "white",
				padding: "2rem",
				borderRadius: "8px",
				boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
				width: "100%",
				maxWidth: "400px"
			},
			children: [/* @__PURE__ */ jsx("h2", {
				style: {
					marginTop: 0,
					marginBottom: "1.5rem",
					textAlign: "center"
				},
				children: "Sign In"
			}), /* @__PURE__ */ jsxs("form", {
				onSubmit: handleSubmit,
				children: [
					/* @__PURE__ */ jsxs("div", {
						style: { marginBottom: "1rem" },
						children: [/* @__PURE__ */ jsx("label", {
							htmlFor: "email",
							style: {
								display: "block",
								marginBottom: "0.5rem",
								fontWeight: "bold"
							},
							children: "Email"
						}), /* @__PURE__ */ jsx("input", {
							id: "email",
							type: "email",
							value: email,
							onChange: (e) => setEmail(e.target.value),
							required: true,
							style: {
								width: "100%",
								padding: "0.75rem",
								borderRadius: "4px",
								border: "1px solid #d1d5db"
							}
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						style: { marginBottom: "1.5rem" },
						children: [/* @__PURE__ */ jsx("label", {
							htmlFor: "password",
							style: {
								display: "block",
								marginBottom: "0.5rem",
								fontWeight: "bold"
							},
							children: "Password"
						}), /* @__PURE__ */ jsx("input", {
							id: "password",
							type: "password",
							value: password,
							onChange: (e) => setPassword(e.target.value),
							required: true,
							style: {
								width: "100%",
								padding: "0.75rem",
								borderRadius: "4px",
								border: "1px solid #d1d5db"
							}
						})]
					}),
					error && /* @__PURE__ */ jsx("div", {
						style: {
							color: "#dc2626",
							marginBottom: "1rem",
							fontWeight: "bold"
						},
						id: "error-message",
						children: error
					}),
					/* @__PURE__ */ jsx("button", {
						type: "submit",
						disabled: loading,
						style: {
							width: "100%",
							padding: "0.75rem",
							backgroundColor: "#2563eb",
							color: "white",
							border: "none",
							borderRadius: "4px",
							fontWeight: "bold",
							cursor: "pointer",
							opacity: loading ? .7 : 1
						},
						children: loading ? "Signing in..." : "Sign In"
					})
				]
			})]
		})
	});
}
//#endregion
export { LoginComponent as component };
