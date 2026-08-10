import { n as getBoardFn, r as moveCardFn, t as Route } from "./routes-BWrjPCwN.js";
import { useEffect, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragOverlay, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
//#region src/components/board.tsx
function toBoardState(data) {
	const state = {};
	for (const col of data.columns) state[col.id] = col.cards;
	return state;
}
function Board({ initialData }) {
	const queryClient = useQueryClient();
	const { data } = useQuery({
		queryKey: ["board"],
		queryFn: () => getBoardFn(),
		initialData
	});
	const columnMeta = data.columns.map((c) => ({
		id: c.id,
		title: c.title
	}));
	const columnIds = columnMeta.map((c) => c.id);
	const [board, setBoard] = useState(() => toBoardState(data));
	useEffect(() => {
		setBoard(toBoardState(data));
	}, [data]);
	const moveMutation = useMutation({
		mutationFn: (vars) => moveCardFn({ data: vars }),
		onSuccess: (result) => {
			queryClient.setQueryData(["board"], result);
		},
		onError: () => {
			queryClient.invalidateQueries({ queryKey: ["board"] });
		}
	});
	const [activeCard, setActiveCard] = useState(null);
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
	function findColumnOfCard(cardId, state) {
		return columnMeta.find((c) => state[c.id]?.some((cd) => cd.id === cardId))?.id;
	}
	function handleDragStart(event) {
		const id = Number(event.active.id);
		for (const colId of Object.keys(board)) {
			const found = board[colId]?.find((c) => c.id === id);
			if (found) {
				setActiveCard(found);
				break;
			}
		}
	}
	function handleDragCancel() {
		setActiveCard(null);
	}
	function handleDragEnd(event) {
		const { active, over } = event;
		setActiveCard(null);
		if (!over) return;
		const activeId = Number(active.id);
		const overIdRaw = String(over.id);
		const fromColId = findColumnOfCard(activeId, board);
		if (!fromColId) return;
		let toColId;
		let toIndex;
		if (columnIds.includes(overIdRaw)) {
			toColId = overIdRaw;
			toIndex = board[toColId]?.length ?? 0;
		} else {
			const overCardId = Number(overIdRaw);
			const foundCol = columnMeta.find((c) => board[c.id]?.some((cd) => cd.id === overCardId));
			if (!foundCol) return;
			toColId = foundCol.id;
			toIndex = board[toColId].findIndex((cd) => cd.id === overCardId);
		}
		const fromCards = board[fromColId] ?? [];
		const fromIndex = fromCards.findIndex((cd) => cd.id === activeId);
		if (fromIndex === -1) return;
		if (fromColId === toColId && fromIndex === toIndex) return;
		const newFromCards = [...fromCards];
		const [moved] = newFromCards.splice(fromIndex, 1);
		const next = {
			...board,
			[fromColId]: newFromCards
		};
		let finalIndex;
		if (fromColId === toColId) {
			finalIndex = Math.min(toIndex, newFromCards.length);
			newFromCards.splice(finalIndex, 0, moved);
			next[fromColId] = newFromCards;
		} else {
			const newToCards = [...board[toColId] ?? []];
			finalIndex = Math.min(toIndex, newToCards.length);
			newToCards.splice(finalIndex, 0, moved);
			next[toColId] = newToCards;
		}
		setBoard(next);
		moveMutation.mutate({
			cardId: activeId,
			toColumnId: toColId,
			toIndex: finalIndex
		});
	}
	return /* @__PURE__ */ jsxs(DndContext, {
		sensors,
		collisionDetection: closestCorners,
		onDragStart: handleDragStart,
		onDragEnd: handleDragEnd,
		onDragCancel: handleDragCancel,
		children: [/* @__PURE__ */ jsx("div", {
			className: "board",
			children: columnMeta.map((col) => /* @__PURE__ */ jsx(ColumnView, {
				id: col.id,
				title: col.title,
				cards: board[col.id] ?? []
			}, col.id))
		}), /* @__PURE__ */ jsx(DragOverlay, { children: activeCard ? /* @__PURE__ */ jsx(CardOverlay, { title: activeCard.title }) : null })]
	});
}
function ColumnView({ id, title, cards }) {
	const { setNodeRef } = useDroppable({ id });
	return /* @__PURE__ */ jsxs("div", {
		className: "column",
		ref: setNodeRef,
		"data-column-id": id,
		children: [/* @__PURE__ */ jsx("h2", { children: title }), /* @__PURE__ */ jsx(SortableContext, {
			items: cards.map((c) => c.id),
			strategy: verticalListSortingStrategy,
			children: /* @__PURE__ */ jsxs("div", {
				className: "card-list",
				children: [cards.map((card) => /* @__PURE__ */ jsx(CardView, { card }, card.id)), cards.length === 0 ? /* @__PURE__ */ jsx("div", { className: "empty-placeholder" }) : null]
			})
		})]
	});
}
function CardView({ card }) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });
	return /* @__PURE__ */ jsx("div", {
		ref: setNodeRef,
		style: {
			transform: CSS.Transform.toString(transform),
			transition,
			opacity: isDragging ? .4 : 1
		},
		className: "card",
		"data-card-id": card.id,
		...attributes,
		...listeners,
		children: card.title
	});
}
function CardOverlay({ title }) {
	return /* @__PURE__ */ jsx("div", {
		className: "card card-overlay",
		children: title
	});
}
//#endregion
//#region src/routes/index.tsx?tsr-split=component
function HomePage() {
	const initialData = Route.useLoaderData();
	return /* @__PURE__ */ jsxs("div", {
		className: "page",
		children: [/* @__PURE__ */ jsx("h1", { children: "Kanban Board" }), /* @__PURE__ */ jsx(Board, { initialData })]
	});
}
//#endregion
export { HomePage as component };
