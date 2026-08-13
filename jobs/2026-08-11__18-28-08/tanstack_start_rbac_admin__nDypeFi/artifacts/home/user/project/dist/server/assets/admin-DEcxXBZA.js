import { a as setRoleFn, i as logoutFn } from "./server-functions-B2Mv98Du.js";
import { t as Route } from "./admin-D1SAo_nc.js";
import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { jsx, jsxs } from "react/jsx-runtime";
//#region src/routes/admin.tsx?tsr-split=component
function AdminComponent() {
	const { users } = Route.useLoaderData();
	const { user } = Route.useRouteContext();
	const router = useRouter();
	const navigate = useNavigate();
	const [error, setError] = useState(null);
	const [updatingEmail, setUpdatingEmail] = useState(null);
	const handleRoleChange = async (email, newRole) => {
		setError(null);
		setUpdatingEmail(email);
		try {
			await setRoleFn({ data: {
				email,
				role: newRole
			} });
			await router.invalidate();
		} catch (err) {
			setError(err.message || "Failed to update role");
		} finally {
			setUpdatingEmail(null);
		}
	};
	const handleLogout = async () => {
		try {
			await logoutFn();
			navigate({ to: "/login" });
		} catch (err) {
			console.error("Logout failed", err);
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		style: {
			padding: "2rem",
			maxWidth: "800px",
			margin: "0 auto",
			width: "100%",
			boxSizing: "border-box"
		},
		children: [
			/* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "2rem"
				},
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
					style: {
						fontSize: "2rem",
						fontWeight: "bold",
						margin: 0
					},
					children: "ADMIN CONSOLE 8842"
				}), /* @__PURE__ */ jsxs("p", {
					style: {
						color: "#4b5563",
						margin: "0.25rem 0 0 0"
					},
					children: [
						"Logged in as: ",
						/* @__PURE__ */ jsx("strong", { children: user?.email }),
						" (",
						user?.role,
						")"
					]
				})] }), /* @__PURE__ */ jsx("button", {
					onClick: handleLogout,
					style: {
						padding: "0.5rem 1rem",
						backgroundColor: "#ef4444",
						color: "#ffffff",
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
					padding: "0.75rem",
					backgroundColor: "#fef2f2",
					color: "#b91c1c",
					borderRadius: "4px",
					marginBottom: "1.5rem"
				},
				children: error
			}),
			/* @__PURE__ */ jsx("div", {
				style: {
					backgroundColor: "#ffffff",
					borderRadius: "8px",
					boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
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
								children: "Role"
							}),
							/* @__PURE__ */ jsx("th", {
								style: { padding: "1rem" },
								children: "Actions"
							})
						]
					}) }), /* @__PURE__ */ jsx("tbody", { children: users.map((u) => /* @__PURE__ */ jsxs("tr", {
						style: { borderBottom: "1px solid #e5e7eb" },
						children: [
							/* @__PURE__ */ jsxs("td", {
								style: {
									padding: "1rem",
									fontWeight: u.email === user?.email ? "bold" : "normal"
								},
								children: [
									u.email,
									" ",
									u.email === user?.email && /* @__PURE__ */ jsx("span", {
										style: {
											fontSize: "0.75rem",
											color: "#2563eb",
											backgroundColor: "#dbeafe",
											padding: "0.125rem 0.375rem",
											borderRadius: "9999px",
											marginLeft: "0.5rem"
										},
										children: "You"
									})
								]
							}),
							/* @__PURE__ */ jsx("td", {
								style: { padding: "1rem" },
								children: /* @__PURE__ */ jsx("span", {
									style: {
										fontSize: "0.875rem",
										padding: "0.25rem 0.5rem",
										borderRadius: "4px",
										backgroundColor: u.role === "admin" ? "#dcfce7" : "#f3f4f6",
										color: u.role === "admin" ? "#15803d" : "#374151",
										fontWeight: "bold"
									},
									children: u.role
								})
							}),
							/* @__PURE__ */ jsx("td", {
								style: { padding: "1rem" },
								children: /* @__PURE__ */ jsxs("select", {
									value: u.role,
									disabled: updatingEmail === u.email,
									onChange: (e) => handleRoleChange(u.email, e.target.value),
									style: {
										padding: "0.375rem 0.5rem",
										borderRadius: "4px",
										border: "1px solid #d1d5db",
										backgroundColor: "#ffffff",
										cursor: "pointer"
									},
									children: [/* @__PURE__ */ jsx("option", {
										value: "admin",
										children: "admin"
									}), /* @__PURE__ */ jsx("option", {
										value: "user",
										children: "user"
									})]
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
