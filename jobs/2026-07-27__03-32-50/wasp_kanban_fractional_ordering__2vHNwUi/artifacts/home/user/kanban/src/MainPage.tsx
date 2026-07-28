import { useState } from "react";
import type { AuthUser } from "wasp/auth";
import {
  useQuery,
  useAction,
  getBoard,
  createColumn,
  createCard,
  moveCard,
} from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import "./Main.css";

type CardData = {
  id: number;
  title: string;
  position: number;
  columnId: number;
};

type ColumnData = {
  id: number;
  title: string;
  position: number;
  cards: CardData[];
};

type MoveCardPayload = {
  cardId: number;
  targetColumnId: number;
  afterCardId?: number;
  beforeCardId?: number;
};

export function MainPage({ user }: { user: AuthUser }) {
  const { data: columns, isLoading, error } = useQuery(getBoard);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newCardTitles, setNewCardTitles] = useState<Record<number, string>>(
    {}
  );

  const moveCardOptimistically = useAction(moveCard, {
    optimisticUpdates: [
      {
        getQuerySpecifier: () => [getBoard],
        updateQuery: (payload: MoveCardPayload, oldData: unknown) => {
          const cols = oldData as ColumnData[] | undefined;
          if (!cols) return oldData;

          const nextCols = cols.map((c) => ({ ...c, cards: [...c.cards] }));

          let moved: CardData | undefined;
          for (const c of nextCols) {
            const idx = c.cards.findIndex((card) => card.id === payload.cardId);
            if (idx !== -1) {
              moved = c.cards.splice(idx, 1)[0];
              break;
            }
          }
          if (!moved) return oldData;

          const target = nextCols.find((c) => c.id === payload.targetColumnId);
          if (!target) return oldData;

          const after = target.cards.find((c) => c.id === payload.afterCardId);
          const before = target.cards.find((c) => c.id === payload.beforeCardId);

          let position: number;
          if (after && before) {
            position = (after.position + before.position) / 2;
          } else if (after) {
            position = after.position + 1;
          } else if (before) {
            position = before.position - 1;
          } else {
            position = 0;
          }

          const updatedCard: CardData = {
            ...moved,
            columnId: target.id,
            position,
          };
          target.cards.push(updatedCard);
          target.cards.sort((a, b) => a.position - b.position);

          return nextCols;
        },
      },
    ],
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const cols: ColumnData[] = columns ?? [];

  function handleAddColumn() {
    if (!newColumnTitle.trim()) return;
    const maxPos = cols.reduce((m, c) => Math.max(m, c.position), -1);
    createColumn({ title: newColumnTitle, position: maxPos + 1 });
    setNewColumnTitle("");
  }

  function handleAddCard(columnId: number) {
    const title = newCardTitles[columnId];
    if (!title || !title.trim()) return;
    const col = cols.find((c) => c.id === columnId);
    const maxPos = col
      ? col.cards.reduce((m, c) => Math.max(m, c.position), -1)
      : -1;
    createCard({ title, columnId, position: maxPos + 1 });
    setNewCardTitles((prev) => ({ ...prev, [columnId]: "" }));
  }

  function moveWithinColumn(card: CardData, direction: "up" | "down") {
    const col = cols.find((c) => c.id === card.columnId);
    if (!col) return;
    const idx = col.cards.findIndex((c) => c.id === card.id);
    if (idx === -1) return;

    if (direction === "up") {
      if (idx === 0) return;
      const before = col.cards[idx - 1];
      const after = idx - 2 >= 0 ? col.cards[idx - 2] : undefined;
      moveCardOptimistically({
        cardId: card.id,
        targetColumnId: card.columnId,
        beforeCardId: before.id,
        afterCardId: after?.id,
      });
    } else {
      if (idx >= col.cards.length - 1) return;
      const after = col.cards[idx + 1];
      const before = idx + 2 < col.cards.length ? col.cards[idx + 2] : undefined;
      moveCardOptimistically({
        cardId: card.id,
        targetColumnId: card.columnId,
        afterCardId: after.id,
        beforeCardId: before?.id,
      });
    }
  }

  function moveToColumn(card: CardData, direction: "prev" | "next") {
    const idx = cols.findIndex((c) => c.id === card.columnId);
    const targetIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= cols.length) return;
    const target = cols[targetIdx];
    const after = target.cards.length
      ? target.cards[target.cards.length - 1]
      : undefined;
    moveCardOptimistically({
      cardId: card.id,
      targetColumnId: target.id,
      afterCardId: after?.id,
    });
  }

  return (
    <main className="board">
      <div className="board-header">
        <h2>Kanban Board</h2>
        <div className="board-header-user">
          <span>{user.identities.username?.id}</span>
          <button onClick={() => logout()}>Logout</button>
        </div>
      </div>

      <div className="board-new-column">
        <input
          value={newColumnTitle}
          onChange={(e) => setNewColumnTitle(e.target.value)}
          placeholder="New column title"
        />
        <button onClick={handleAddColumn}>Add Column</button>
      </div>

      <div className="board-columns">
        {cols.map((col) => (
          <div key={col.id} className="board-column">
            <h3>{col.title}</h3>
            <div className="board-new-card">
              <input
                value={newCardTitles[col.id] ?? ""}
                onChange={(e) =>
                  setNewCardTitles((prev) => ({
                    ...prev,
                    [col.id]: e.target.value,
                  }))
                }
                placeholder="New card title"
              />
              <button onClick={() => handleAddCard(col.id)}>Add</button>
            </div>
            <ul className="board-card-list">
              {col.cards.map((card) => (
                <li key={card.id} className="board-card">
                  <div>{card.title}</div>
                  <div className="board-card-actions">
                    <button
                      title="Move up"
                      onClick={() => moveWithinColumn(card, "up")}
                    >
                      ↑
                    </button>
                    <button
                      title="Move down"
                      onClick={() => moveWithinColumn(card, "down")}
                    >
                      ↓
                    </button>
                    <button
                      title="Move to previous column"
                      onClick={() => moveToColumn(card, "prev")}
                    >
                      ◀
                    </button>
                    <button
                      title="Move to next column"
                      onClick={() => moveToColumn(card, "next")}
                    >
                      ▶
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
