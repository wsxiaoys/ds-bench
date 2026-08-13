import { t as Route } from "./routes-sUmzZAng.js";
import { useEffect, useMemo, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
//#region src/routes/index.tsx?tsr-split=component
function IndexComponent() {
	const { q, sort, page, pageSize } = Route.useSearch();
	const { rows, total, pageCount } = Route.useLoaderData();
	const navigate = Route.useNavigate();
	const [filterInput, setFilterInput] = useState(q);
	useEffect(() => {
		setFilterInput(q);
	}, [q]);
	const handleSubmitFilter = (e) => {
		e.preventDefault();
		navigate({ search: (prev) => ({
			...prev,
			q: filterInput,
			page: 1
		}) });
	};
	const handleSort = (field) => {
		let newSort = `${field}:asc`;
		if (sort === `${field}:asc`) newSort = `${field}:desc`;
		navigate({ search: (prev) => ({
			...prev,
			sort: newSort
		}) });
	};
	const handleNextPage = () => {
		if (page < pageCount) navigate({ search: (prev) => ({
			...prev,
			page: page + 1
		}) });
	};
	const handlePrevPage = () => {
		if (page > 1) navigate({ search: (prev) => ({
			...prev,
			page: page - 1
		}) });
	};
	const columns = useMemo(() => [
		{
			accessorKey: "id",
			header: "ID"
		},
		{
			accessorKey: "name",
			header: "Name",
			cell: ({ getValue }) => /* @__PURE__ */ jsx("span", {
				"data-testid": "cell-name",
				children: getValue()
			})
		},
		{
			accessorKey: "email",
			header: "Email"
		},
		{
			accessorKey: "department",
			header: "Department"
		},
		{
			accessorKey: "salary",
			header: "Salary",
			cell: ({ getValue }) => {
				return /* @__PURE__ */ jsxs("span", { children: ["$", getValue().toLocaleString()] });
			}
		}
	], []);
	const table = useReactTable({
		data: rows,
		columns,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		manualSorting: true,
		manualFiltering: true
	});
	return /* @__PURE__ */ jsxs("div", {
		style: {
			padding: "24px",
			fontFamily: "system-ui, sans-serif",
			maxWidth: "1000px",
			margin: "0 auto"
		},
		children: [
			/* @__PURE__ */ jsx("h1", {
				style: {
					marginBottom: "24px",
					fontSize: "28px",
					color: "#111"
				},
				children: "Employee Data Grid"
			}),
			/* @__PURE__ */ jsxs("div", {
				style: {
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: "16px"
				},
				children: [/* @__PURE__ */ jsx("form", {
					onSubmit: handleSubmitFilter,
					children: /* @__PURE__ */ jsx("input", {
						type: "text",
						"data-testid": "global-filter",
						value: filterInput,
						onChange: (e) => setFilterInput(e.target.value),
						placeholder: "Search by name or email... (Press Enter)",
						style: {
							padding: "8px 12px",
							fontSize: "14px",
							width: "320px",
							borderRadius: "6px",
							border: "1px solid #ccc",
							outline: "none"
						}
					})
				}), /* @__PURE__ */ jsxs("div", {
					style: {
						fontSize: "15px",
						fontWeight: 600,
						color: "#444"
					},
					children: ["Total Employees: ", /* @__PURE__ */ jsx("span", {
						"data-testid": "total-count",
						children: total
					})]
				})]
			}),
			/* @__PURE__ */ jsx("div", {
				style: {
					overflowX: "auto",
					border: "1px solid #e0e0e0",
					borderRadius: "8px"
				},
				children: /* @__PURE__ */ jsxs("table", {
					style: {
						width: "100%",
						borderCollapse: "collapse",
						backgroundColor: "#fff"
					},
					children: [/* @__PURE__ */ jsx("thead", { children: table.getHeaderGroups().map((headerGroup) => /* @__PURE__ */ jsx("tr", {
						style: {
							borderBottom: "2px solid #e0e0e0",
							backgroundColor: "#f9f9f9"
						},
						children: headerGroup.headers.map((header) => {
							const field = header.column.id;
							const isSorted = sort.startsWith(`${field}:`);
							const isDesc = sort.endsWith(":desc");
							return /* @__PURE__ */ jsx("th", {
								style: {
									padding: "12px 16px",
									textAlign: "left"
								},
								children: /* @__PURE__ */ jsxs("button", {
									"data-testid": `sort-${field}`,
									onClick: () => handleSort(field),
									style: {
										background: "none",
										border: "none",
										cursor: "pointer",
										fontFamily: "inherit",
										fontSize: "14px",
										fontWeight: "bold",
										color: "#333",
										display: "inline-flex",
										alignItems: "center",
										gap: "6px",
										padding: 0
									},
									children: [flexRender(header.column.columnDef.header, header.getContext()), /* @__PURE__ */ jsx("span", {
										style: {
											fontSize: "12px",
											color: isSorted ? "#000" : "#aaa"
										},
										children: isSorted ? isDesc ? "↓" : "↑" : "↕"
									})]
								})
							}, header.id);
						})
					}, headerGroup.id)) }), /* @__PURE__ */ jsx("tbody", { children: table.getRowModel().rows.length > 0 ? table.getRowModel().rows.map((row) => /* @__PURE__ */ jsx("tr", {
						style: {
							borderBottom: "1px solid #e0e0e0",
							transition: "background-color 0.2s"
						},
						children: row.getVisibleCells().map((cell) => /* @__PURE__ */ jsx("td", {
							style: {
								padding: "12px 16px",
								fontSize: "14px",
								color: "#555"
							},
							children: flexRender(cell.column.columnDef.cell, cell.getContext())
						}, cell.id))
					}, row.id)) : /* @__PURE__ */ jsx("tr", { children: /* @__PURE__ */ jsx("td", {
						colSpan: columns.length,
						style: {
							padding: "24px",
							textAlign: "center",
							color: "#888"
						},
						children: "No employees found"
					}) }) })]
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				style: {
					marginTop: "20px",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center"
				},
				children: [/* @__PURE__ */ jsxs("div", {
					style: {
						fontSize: "14px",
						color: "#666"
					},
					children: [
						"Page ",
						page,
						" of ",
						pageCount
					]
				}), /* @__PURE__ */ jsxs("div", {
					style: {
						display: "flex",
						gap: "8px"
					},
					children: [/* @__PURE__ */ jsx("button", {
						"data-testid": "prev-page",
						onClick: handlePrevPage,
						disabled: page <= 1,
						style: {
							padding: "8px 16px",
							fontSize: "14px",
							borderRadius: "6px",
							border: "1px solid #ccc",
							cursor: page <= 1 ? "not-allowed" : "pointer",
							backgroundColor: page <= 1 ? "#f5f5f5" : "#fff",
							color: page <= 1 ? "#999" : "#333",
							fontWeight: 500
						},
						children: "Previous"
					}), /* @__PURE__ */ jsx("button", {
						"data-testid": "next-page",
						onClick: handleNextPage,
						disabled: page >= pageCount,
						style: {
							padding: "8px 16px",
							fontSize: "14px",
							borderRadius: "6px",
							border: "1px solid #ccc",
							cursor: page >= pageCount ? "not-allowed" : "pointer",
							backgroundColor: page >= pageCount ? "#f5f5f5" : "#fff",
							color: page >= pageCount ? "#999" : "#333",
							fontWeight: 500
						},
						children: "Next"
					})]
				})]
			})
		]
	});
}
//#endregion
export { IndexComponent as component };
