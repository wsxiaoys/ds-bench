import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getBoardFn, moveCardFn } from "~/server/board.functions";

export type Card = { id: number; title: string; position: number };
export type Column = { id: string; title: string; cards: Card[] };
export type BoardData = { columns: Column[] };

type BoardState = Record<string, Card[]>;

function toBoardState(data: BoardData): BoardState {
  const state: BoardState = {};
  for (const col of data.columns) {
    state[col.id] = col.cards;
  }
  return state;
}

export function Board({ initialData }: { initialData: BoardData }) {
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["board"],
    queryFn: () => getBoardFn(),
    initialData,
  });

  const columnMeta = data.columns.map((c) => ({ id: c.id, title: c.title }));
  const columnIds = columnMeta.map((c) => c.id);

  const [board, setBoard] = useState<BoardState>(() => toBoardState(data));

  useEffect(() => {
    setBoard(toBoardState(data));
  }, [data]);

  const moveMutation = useMutation({
    mutationFn: (vars: {
      cardId: number;
      toColumnId: string;
      toIndex: number;
    }) => moveCardFn({ data: vars }),
    onSuccess: (result) => {
      queryClient.setQueryData(["board"], result);
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });

  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  function findColumnOfCard(cardId: number, state: BoardState) {
    return columnMeta.find((c) => state[c.id]?.some((cd) => cd.id === cardId))
      ?.id;
  }

  function handleDragStart(event: DragStartEvent) {
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveCard(null);
    if (!over) return;

    const activeId = Number(active.id);
    const overIdRaw = String(over.id);

    const fromColId = findColumnOfCard(activeId, board);
    if (!fromColId) return;

    let toColId: string;
    let toIndex: number;

    if (columnIds.includes(overIdRaw)) {
      toColId = overIdRaw;
      toIndex = board[toColId]?.length ?? 0;
    } else {
      const overCardId = Number(overIdRaw);
      const foundCol = columnMeta.find((c) =>
        board[c.id]?.some((cd) => cd.id === overCardId),
      );
      if (!foundCol) return;
      toColId = foundCol.id;
      toIndex = board[toColId].findIndex((cd) => cd.id === overCardId);
    }

    const fromCards = board[fromColId] ?? [];
    const fromIndex = fromCards.findIndex((cd) => cd.id === activeId);
    if (fromIndex === -1) return;

    if (fromColId === toColId && fromIndex === toIndex) {
      return;
    }

    const newFromCards = [...fromCards];
    const [moved] = newFromCards.splice(fromIndex, 1);

    const next: BoardState = { ...board, [fromColId]: newFromCards };

    let finalIndex: number;
    if (fromColId === toColId) {
      finalIndex = Math.min(toIndex, newFromCards.length);
      newFromCards.splice(finalIndex, 0, moved);
      next[fromColId] = newFromCards;
    } else {
      const newToCards = [...(board[toColId] ?? [])];
      finalIndex = Math.min(toIndex, newToCards.length);
      newToCards.splice(finalIndex, 0, moved);
      next[toColId] = newToCards;
    }

    setBoard(next);
    moveMutation.mutate({
      cardId: activeId,
      toColumnId: toColId,
      toIndex: finalIndex,
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="board">
        {columnMeta.map((col) => (
          <ColumnView
            key={col.id}
            id={col.id}
            title={col.title}
            cards={board[col.id] ?? []}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? <CardOverlay title={activeCard.title} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function ColumnView({
  id,
  title,
  cards,
}: {
  id: string;
  title: string;
  cards: Card[];
}) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div className="column" ref={setNodeRef} data-column-id={id}>
      <h2>{title}</h2>
      <SortableContext
        items={cards.map((c) => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="card-list">
          {cards.map((card) => (
            <CardView key={card.id} card={card} />
          ))}
          {cards.length === 0 ? <div className="empty-placeholder" /> : null}
        </div>
      </SortableContext>
    </div>
  );
}

function CardView({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="card"
      data-card-id={card.id}
      {...attributes}
      {...listeners}
    >
      {card.title}
    </div>
  );
}

function CardOverlay({ title }: { title: string }) {
  return <div className="card card-overlay">{title}</div>;
}
