import { n as getBoardFn, r as moveCardFn } from "./routes-DghFvbC1.js";
import "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, PointerSensor, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
//#region src/routes/index.tsx?tsr-split=component
function SortableCard({ id, title }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
	return /* @__PURE__ */ jsx("div", {
		ref: setNodeRef,
		style: {
			transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : void 0,
			transition,
			opacity: isDragging ? .5 : 1
		},
		...attributes,
		...listeners,
		className: `card ${isDragging ? "dragging" : ""}`,
		children: /* @__PURE__ */ jsx("div", {
			className: "card-title",
			children: title
		})
	});
}
function Column({ id, title, cards }) {
	const { setNodeRef } = useDroppable({ id });
	return /* @__PURE__ */ jsxs("div", {
		ref: setNodeRef,
		className: "column",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "column-header",
			children: [/* @__PURE__ */ jsx("span", {
				className: "column-title",
				children: title
			}), /* @__PURE__ */ jsx("span", {
				className: "column-count",
				children: cards.length
			})]
		}), /* @__PURE__ */ jsx(SortableContext, {
			items: cards.map((c) => c.id),
			strategy: verticalListSortingStrategy,
			children: /* @__PURE__ */ jsx("div", {
				className: "card-list",
				children: cards.map((card) => /* @__PURE__ */ jsx(SortableCard, {
					id: card.id,
					title: card.title
				}, card.id))
			})
		})]
	});
}
function Home() {
	const queryClient = useQueryClient();
	const { data: board, isLoading, error } = useQuery({
		queryKey: ["board"],
		queryFn: () => getBoardFn()
	});
	const moveCardMutation = useMutation({
		mutationFn: (variables) => moveCardFn({ data: variables }),
		onMutate: async (variables) => {
			await queryClient.cancelQueries({ queryKey: ["board"] });
			const previousBoard = queryClient.getQueryData(["board"]);
			queryClient.setQueryData(["board"], (old) => {
				if (!old) return old;
				const newColumns = old.columns.map((col) => ({
					...col,
					cards: [...col.cards]
				}));
				let movedCard = null;
				let sourceColId = "";
				for (const col of newColumns) {
					const idx = col.cards.findIndex((c) => c.id === variables.cardId);
					if (idx !== -1) {
						movedCard = col.cards[idx];
						sourceColId = col.id;
						col.cards.splice(idx, 1);
						break;
					}
				}
				if (!movedCard) return old;
				const targetCol = newColumns.find((col) => col.id === variables.targetCol);
				if (!targetCol) return old;
				const targetPos = Math.max(0, Math.min(variables.targetPos, targetCol.cards.length));
				targetCol.cards.splice(targetPos, 0, movedCard);
				const sourceCol = newColumns.find((col) => col.id === sourceColId);
				if (sourceCol) sourceCol.cards = sourceCol.cards.map((c, index) => ({
					...c,
					position: index
				}));
				targetCol.cards = targetCol.cards.map((c, index) => ({
					...c,
					position: index
				}));
				return {
					...old,
					columns: newColumns
				};
			});
			return { previousBoard };
		},
		onError: (err, variables, context) => {
			if (context?.previousBoard) queryClient.setQueryData(["board"], context.previousBoard);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["board"] });
		}
	});
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
	const handleDragEnd = (event) => {
		const { active, over } = event;
		if (!over) return;
		const activeCardId = active.id;
		if (!board) return;
		let sourceColId = "";
		for (const col of board.columns) if (col.cards.some((c) => c.id === activeCardId)) {
			sourceColId = col.id;
			break;
		}
		if (!sourceColId) return;
		let targetColId = "";
		let targetPos = 0;
		if (over.id === "todo" || over.id === "in-progress" || over.id === "done") {
			targetColId = over.id;
			const targetCol = board.columns.find((col) => col.id === targetColId);
			targetPos = targetCol ? targetCol.cards.length : 0;
		} else {
			const overCardId = over.id;
			let overCard = null;
			let overCol = null;
			for (const col of board.columns) {
				const found = col.cards.find((c) => c.id === overCardId);
				if (found) {
					overCard = found;
					overCol = col;
					break;
				}
			}
			if (!overCol || !overCard) return;
			targetColId = overCol.id;
			targetPos = overCol.cards.findIndex((c) => c.id === overCardId);
		}
		moveCardMutation.mutate({
			cardId: activeCardId,
			targetCol: targetColId,
			targetPos
		});
	};
	if (isLoading) return /* @__PURE__ */ jsx("div", {
		className: "app-container",
		children: /* @__PURE__ */ jsxs("header", { children: [/* @__PURE__ */ jsx("h1", { children: "Full-Stack Kanban Board" }), /* @__PURE__ */ jsx("p", { children: "Loading board state..." })] })
	});
	if (error || !board) return /* @__PURE__ */ jsx("div", {
		className: "app-container",
		children: /* @__PURE__ */ jsxs("header", { children: [/* @__PURE__ */ jsx("h1", { children: "Full-Stack Kanban Board" }), /* @__PURE__ */ jsx("p", {
			style: { color: "red" },
			children: "Error loading board state"
		})] })
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "app-container",
		children: [/* @__PURE__ */ jsxs("header", { children: [/* @__PURE__ */ jsx("h1", { children: "Full-Stack Kanban Board" }), /* @__PURE__ */ jsx("p", { children: "Drag and drop cards to organize your workflow" })] }), /* @__PURE__ */ jsx(DndContext, {
			sensors,
			onDragEnd: handleDragEnd,
			children: /* @__PURE__ */ jsx("div", {
				className: "board",
				children: board.columns.map((col) => /* @__PURE__ */ jsx(Column, {
					id: col.id,
					title: col.title,
					cards: col.cards
				}, col.id))
			})
		})]
	});
}
//#endregion
export { Home as component };
