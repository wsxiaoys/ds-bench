import { a as setRoleFn, i as logoutFn } from "./server-fns-qrxJ0EdC.js";
import { t as Route } from "./admin-BT7zRFy2.js";
import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/admin.tsx?tsr-split=component
function AdminComponent() {
	const { users } = Route.useLoaderData();
	const router = useRouter();
	const navigate = useNavigate();
	const [updatingEmail, setUpdatingEmail] = useState(null);
	const [error, setError] = useState("");
	const handleRoleChange = async (email, currentRole) => {
		setError("");
		setUpdatingEmail(email);
		const newRole = currentRole === "admin" ? "user" : "admin";
		try {
			const result = await setRoleFn({ data: {
				email,
				role: newRole
			} });
			if (result && "error" in result) setError(result.error || "Failed to update role");
			else await router.invalidate();
		} catch (err) {
			setError("An error occurred while updating the role");
		} finally {
			setUpdatingEmail(null);
		}
	};
	const handleLogout = async () => {
		await logoutFn();
		navigate({ to: "/login" });
	};
	return /* @__PURE__ */ jsxs("div", {
		style: {
			padding: "2rem",
			maxWidth: "800px",
			margin: "0 auto"
		},
		children: [
			/* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "2rem"
				},
				children: [/* @__PURE__ */ jsx("h1", {
					style: { margin: 0 },
					children: "ADMIN CONSOLE 8842"
				}), /* @__PURE__ */ jsx("button", {
					onClick: handleLogout,
					style: {
						padding: "0.5rem 1rem",
						backgroundColor: "#ef4444",
						color: "white",
						border: "none",
						borderRadius: "4px",
						fontWeight: "bold",
						cursor: "pointer"
					},
					children: "Logout"
				})]
			}),
			error && /* @__PURE__ */ jsx("div", {
				style: {
					padding: "1rem",
					backgroundColor: "#fee2e2",
					color: "#991b1b",
					borderRadius: "4px",
					marginBottom: "1.5rem",
					fontWeight: "bold"
				},
				children: error
			}),
			/* @__PURE__ */ jsx("div", {
				style: {
					background: "white",
					borderRadius: "8px",
					boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
					overflow: "hidden"
				},
				children: /* @__PURE__ */ jsxs("table", {
					style: {
						width: "100%",
						borderCollapse: "collapse",
						textAlign: "left"
					},
					children: [/* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", {
						style: {
							backgroundColor: "#f3f4f6",
							borderBottom: "1px solid #e5e7eb"
						},
						children: [
							/* @__PURE__ */ jsx("th", {
								style: { padding: "1rem" },
								children: "Email"
							}),
							/* @__PURE__ */ jsx("th", {
								style: { padding: "1rem" },
								children: "Current Role"
							}),
							/* @__PURE__ */ jsx("th", {
								style: {
									padding: "1rem",
									textAlign: "right"
								},
								children: "Actions"
							})
						]
					}) }), /* @__PURE__ */ jsx("tbody", { children: users.map((u) => /* @__PURE__ */ jsxs("tr", {
						style: { borderBottom: "1px solid #e5e7eb" },
						children: [
							/* @__PURE__ */ jsx("td", {
								style: { padding: "1rem" },
								children: u.email
							}),
							/* @__PURE__ */ jsx("td", {
								style: { padding: "1rem" },
								children: /* @__PURE__ */ jsx("span", {
									style: {
										padding: "0.25rem 0.5rem",
										borderRadius: "4px",
										fontSize: "0.875rem",
										fontWeight: "bold",
										backgroundColor: u.role === "admin" ? "#d1fae5" : "#e0f2fe",
										color: u.role === "admin" ? "#065f46" : "#0369a1"
									},
									children: u.role
								})
							}),
							/* @__PURE__ */ jsx("td", {
								style: {
									padding: "1rem",
									textAlign: "right"
								},
								children: /* @__PURE__ */ jsx("button", {
									onClick: () => handleRoleChange(u.email, u.role),
									disabled: updatingEmail === u.email,
									style: {
										padding: "0.5rem 1rem",
										backgroundColor: "#2563eb",
										color: "white",
										border: "none",
										borderRadius: "4px",
										fontWeight: "bold",
										cursor: "pointer",
										opacity: updatingEmail === u.email ? .7 : 1
									},
									children: updatingEmail === u.email ? "Updating..." : `Change to ${u.role === "admin" ? "user" : "admin"}`
								})
							})
						]
					}, u.email)) })]
				})
			})
		]
	});
}
//#endregion
export { AdminComponent as component };
