import { i as logoutFn } from "./server-fns-qrxJ0EdC.js";
import { t as Route } from "./routes-DMthp3oz.js";
import { useNavigate } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/index.tsx?tsr-split=component
function HomeComponent() {
	const { user } = Route.useLoaderData();
	const navigate = useNavigate();
	const handleLogout = async () => {
		await logoutFn();
		navigate({ to: "/login" });
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
				maxWidth: "500px",
				textAlign: "center"
			},
			children: [
				/* @__PURE__ */ jsx("h1", {
					style: {
						marginTop: 0,
						color: "#1f2937"
					},
					children: "Welcome Home"
				}),
				/* @__PURE__ */ jsx("p", {
					style: {
						fontSize: "1.1rem",
						color: "#4b5563"
					},
					children: "You are logged in as:"
				}),
				/* @__PURE__ */ jsxs("div", {
					style: {
						background: "#f3f4f6",
						padding: "1rem",
						borderRadius: "6px",
						margin: "1.5rem 0",
						textAlign: "left"
					},
					children: [/* @__PURE__ */ jsxs("p", {
						style: { margin: "0 0 0.5rem 0" },
						children: [
							/* @__PURE__ */ jsx("strong", { children: "Email:" }),
							" ",
							user?.email
						]
					}), /* @__PURE__ */ jsxs("p", {
						style: { margin: 0 },
						children: [
							/* @__PURE__ */ jsx("strong", { children: "Role:" }),
							" ",
							user?.role
						]
					})]
				}),
				user?.role === "admin" && /* @__PURE__ */ jsx("button", {
					onClick: () => navigate({ to: "/admin" }),
					style: {
						width: "100%",
						padding: "0.75rem",
						backgroundColor: "#10b981",
						color: "white",
						border: "none",
						borderRadius: "4px",
						fontWeight: "bold",
						cursor: "pointer",
						marginBottom: "1rem"
					},
					children: "Go to Admin Console"
				}),
				/* @__PURE__ */ jsx("button", {
					onClick: handleLogout,
					style: {
						width: "100%",
						padding: "0.75rem",
						backgroundColor: "#ef4444",
						color: "white",
						border: "none",
						borderRadius: "4px",
						fontWeight: "bold",
						cursor: "pointer"
					},
					children: "Logout"
				})
			]
		})
	});
}
//#endregion
export { HomeComponent as component };
