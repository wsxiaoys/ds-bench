import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "../server.js";
import { useEffect, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
//#region node_modules/@tanstack/start-server-core/dist/esm/createSsrRpc.js
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
//#endregion
//#region src/serverFunctions.ts
var getBoardStateFn = createServerFn({ method: "GET" }).handler(createSsrRpc("e4642b9211f79568b81a5d6c7852350dff5e34c90e45a0ebb32633c72c41247d"));
var moveCardFn = createServerFn({ method: "POST" }).validator((data) => data).handler(createSsrRpc("d90e23f36ddeb8f9dea5a8e7ffc37d3ac77db82c02bf3f6de94b8c79799fc92f"));
//#endregion
//#region src/routes/index.tsx?tsr-split=component
function BoardComponent() {
	const queryClient = useQueryClient();
	const { data: queryData, isLoading, error } = useQuery({
		queryKey: ["board"],
		queryFn: () => getBoardStateFn()
	});
	const [columns, setColumns] = useState([]);
	useEffect(() => {
		if (queryData) setColumns(queryData.columns);
	}, [queryData]);
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
	const moveCardMutation = useMutation({
		mutationFn: moveCardFn,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["board"] });
		}
	});
	if (isLoading) return /* @__PURE__ */ jsxs("div", {
		className: "kanban-container",
		children: [/* @__PURE__ */ jsx("header", {
			className: "header",
			children: /* @__PURE__ */ jsx("h1", {
				className: "header-title",
				children: "Kanban Board"
			})
		}), /* @__PURE__ */ jsx("div", {
			style: {
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				height: "300px"
			},
			children: /* @__PURE__ */ jsx("p", {
				style: {
					fontSize: "1.2rem",
					color: "#6b7280"
				},
				children: "Loading board..."
			})
		})]
	});
	if (error || !queryData) return /* @__PURE__ */ jsxs("div", {
		className: "kanban-container",
		children: [/* @__PURE__ */ jsx("header", {
			className: "header",
			children: /* @__PURE__ */ jsx("h1", {
				className: "header-title",
				children: "Kanban Board"
			})
		}), /* @__PURE__ */ jsx("div", {
			style: {
				display: "flex",
				justifyContent: "center",
				alignItems: "center",
				height: "300px"
			},
			children: /* @__PURE__ */ jsx("p", {
				style: {
					fontSize: "1.2rem",
					color: "#ef4444"
				},
				children: "Error loading board"
			})
		})]
	});
	function findContainer(id, columnsList) {
		if (columnsList.some((col) => col.id === id)) return id;
		const col = columnsList.find((col) => col.cards.some((card) => card.id === Number(id)));
		return col ? col.id : null;
	}
	const handleDragOver = (event) => {
		const { active, over } = event;
		if (!over) return;
		const activeId = active.id;
		const overId = over.id;
		if (activeId === overId) return;
		const activeContainer = findContainer(activeId, columns);
		const overContainer = findContainer(overId, columns);
		if (!activeContainer || !overContainer || activeContainer === overContainer) return;
		setColumns((prev) => {
			const activeCol = prev.find((c) => c.id === activeContainer);
			const overCol = prev.find((c) => c.id === overContainer);
			const activeCardIndex = activeCol.cards.findIndex((c) => c.id === Number(activeId));
			if (activeCardIndex === -1) return prev;
			const activeCard = activeCol.cards[activeCardIndex];
			let overCardIndex = overCol.cards.findIndex((c) => c.id === Number(overId));
			if (overCardIndex === -1) overCardIndex = overCol.cards.length;
			const newActiveCards = activeCol.cards.filter((c) => c.id !== Number(activeId));
			const newOverCards = [...overCol.cards];
			newOverCards.splice(overCardIndex, 0, activeCard);
			return prev.map((col) => {
				if (col.id === activeContainer) return {
					...col,
					cards: newActiveCards.map((c, i) => ({
						...c,
						position: i
					}))
				};
				if (col.id === overContainer) return {
					...col,
					cards: newOverCards.map((c, i) => ({
						...c,
						position: i
					}))
				};
				return col;
			});
		});
	};
	const handleDragEnd = async (event) => {
		const { active, over } = event;
		if (!over) {
			setColumns(queryData.columns);
			return;
		}
		const activeId = active.id;
		const overId = over.id;
		const activeContainer = findContainer(activeId, columns);
		const overContainer = findContainer(overId, columns);
		if (!activeContainer || !overContainer) {
			setColumns(queryData.columns);
			return;
		}
		if (activeContainer === overContainer) {
			const col = columns.find((c) => c.id === activeContainer);
			const activeIndex = col.cards.findIndex((c) => c.id === Number(activeId));
			const overIndex = col.cards.findIndex((c) => c.id === Number(overId));
			if (activeIndex !== overIndex) {
				const reorderedCards = arrayMove(col.cards, activeIndex, overIndex).map((c, i) => ({
					...c,
					position: i
				}));
				const updatedColumns = columns.map((c) => {
					if (c.id === activeContainer) return {
						...c,
						cards: reorderedCards
					};
					return c;
				});
				setColumns(updatedColumns);
				try {
					await moveCardMutation.mutateAsync({
						cardId: Number(activeId),
						columnId: activeContainer,
						position: overIndex
					});
				} catch (err) {
					console.error("Failed to move card:", err);
					setColumns(queryData.columns);
				}
			}
		} else {
			const activeIndex = columns.find((c) => c.id === overContainer).cards.findIndex((c) => c.id === Number(activeId));
			if (activeIndex !== -1) try {
				await moveCardMutation.mutateAsync({
					cardId: Number(activeId),
					columnId: overContainer,
					position: activeIndex
				});
			} catch (err) {
				console.error("Failed to move card:", err);
				setColumns(queryData.columns);
			}
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "kanban-container",
		children: [/* @__PURE__ */ jsx("header", {
			className: "header",
			children: /* @__PURE__ */ jsx("h1", {
				className: "header-title",
				children: "Kanban Board"
			})
		}), /* @__PURE__ */ jsx("main", {
			className: "kanban-board",
			children: /* @__PURE__ */ jsx(DndContext, {
				sensors,
				collisionDetection: closestCorners,
				onDragOver: handleDragOver,
				onDragEnd: handleDragEnd,
				children: columns.map((col) => /* @__PURE__ */ jsx(SortableContext, {
					items: col.cards.map((c) => c.id),
					strategy: verticalListSortingStrategy,
					children: /* @__PURE__ */ jsx(ColumnContainer, {
						id: col.id,
						title: col.title,
						children: col.cards.map((card) => /* @__PURE__ */ jsx(SortableCard, { card }, card.id))
					})
				}, col.id))
			})
		})]
	});
}
function ColumnContainer({ id, title, children }) {
	const { setNodeRef } = useDroppable({ id });
	return /* @__PURE__ */ jsxs("div", {
		ref: setNodeRef,
		className: "kanban-column",
		children: [/* @__PURE__ */ jsx("h2", {
			className: "kanban-column-title",
			children: title
		}), /* @__PURE__ */ jsx("div", {
			className: "kanban-cards-list",
			children
		})]
	});
}
function SortableCard({ card }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
	return /* @__PURE__ */ jsx("div", {
		ref: setNodeRef,
		style: {
			transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : void 0,
			transition,
			opacity: isDragging ? .5 : 1
		},
		...attributes,
		...listeners,
		className: "kanban-card",
		children: /* @__PURE__ */ jsx("p", {
			className: "kanban-card-title",
			children: card.title
		})
	});
}
//#endregion
export { BoardComponent as component };
