import { getUsername } from "wasp/auth";
import { logout } from "wasp/client/auth";
import { useQuery, useAction, getBoard, createColumn, createCard, moveCard } from "wasp/client/operations";
import { useState } from "react";
import "./Main.css";

export function MainPage({ user }: { user: any }) {
  const { data: columns, isLoading, error } = useQuery(getBoard);
  const createColumnAction = useAction(createColumn);
  const createCardAction = useAction(createCard);

  const moveCardOptimistically = useAction(moveCard, {
    optimisticUpdates: [
      {
        getQuerySpecifier: () => [getBoard],
        updateQuery: (moveCardArgs: any, oldColumns: any[] | undefined) => {
          if (!oldColumns) return [];

          // Find the card to move
          let movedCard: any = null;
          for (const col of oldColumns) {
            const found = col.cards?.find((c: any) => c.id === moveCardArgs.cardId);
            if (found) {
              movedCard = { ...found };
              break;
            }
          }

          if (!movedCard) {
            return oldColumns;
          }

          // Remove card from its original column
          const nextColumns = oldColumns.map((col) => {
            return {
              ...col,
              cards: col.cards?.filter((c: any) => c.id !== moveCardArgs.cardId) || [],
            };
          });

          // Find target column
          const targetCol = nextColumns.find((col) => col.id === moveCardArgs.targetColumnId);
          if (!targetCol) {
            return oldColumns;
          }

          // Compute the new position of the moved card
          let newPosition: number;
          const targetCards = targetCol.cards || [];

          let afterCard = moveCardArgs.afterCardId
            ? targetCards.find((c: any) => c.id === moveCardArgs.afterCardId)
            : null;
          let beforeCard = moveCardArgs.beforeCardId
            ? targetCards.find((c: any) => c.id === moveCardArgs.beforeCardId)
            : null;

          if (afterCard && beforeCard) {
            newPosition = (afterCard.position + beforeCard.position) / 2.0;
          } else if (afterCard) {
            newPosition = afterCard.position + 1.0;
          } else if (beforeCard) {
            newPosition = beforeCard.position - 1.0;
          } else {
            newPosition = 1.0;
          }

          // Update card fields
          movedCard.columnId = moveCardArgs.targetColumnId;
          movedCard.position = newPosition;

          // Add the card to the target column and sort target column cards by position ascending
          const updatedTargetCards = [...targetCards, movedCard].sort((a: any, b: any) => a.position - b.position);

          return nextColumns.map((col) => {
            if (col.id === moveCardArgs.targetColumnId) {
              return {
                ...col,
                cards: updatedTargetCards,
              };
            }
            return col;
          });
        },
      },
    ],
  });

  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newCardTitles, setNewCardTitles] = useState<Record<number, string>>({});
  const [draggedCardId, setDraggedCardId] = useState<number | null>(null);

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnTitle.trim()) return;
    try {
      const position = columns && columns.length > 0
        ? columns[columns.length - 1].position + 1.0
        : 1.0;
      await createColumnAction({ title: newColumnTitle.trim(), position });
      setNewColumnTitle("");
    } catch (err: any) {
      alert(err.message || "Failed to create column");
    }
  };

  const handleCreateCard = async (e: React.FormEvent, colId: number, colCards: any[]) => {
    e.preventDefault();
    const title = newCardTitles[colId];
    if (!title || !title.trim()) return;
    try {
      const position = colCards && colCards.length > 0
        ? colCards[colCards.length - 1].position + 1.0
        : 1.0;
      await createCardAction({ title: title.trim(), columnId: colId, position });
      setNewCardTitles(prev => ({ ...prev, [colId]: "" }));
    } catch (err: any) {
      alert(err.message || "Failed to create card");
    }
  };

  const onDragStart = (e: React.DragEvent, cardId: number) => {
    e.dataTransfer.setData("text/plain", cardId.toString());
    setDraggedCardId(cardId);
  };

  const onDragEnd = () => {
    setDraggedCardId(null);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDropCard = async (e: React.DragEvent, targetCard: any, targetColumnId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const cardIdStr = e.dataTransfer.getData("text/plain");
    const cardId = parseInt(cardIdStr, 10);
    if (isNaN(cardId)) return;
    if (cardId === targetCard.id) return;

    const targetCol = columns?.find((col: any) => col.id === targetColumnId);
    if (!targetCol) return;
    const cards = targetCol.cards || [];
    const targetIdx = cards.findIndex((c: any) => c.id === targetCard.id);

    let beforeCardId: number | undefined = targetCard.id;
    let afterCardId: number | undefined = undefined;

    if (targetIdx > 0) {
      afterCardId = cards[targetIdx - 1].id;
    }

    try {
      await moveCardOptimistically({
        cardId,
        targetColumnId,
        afterCardId,
        beforeCardId,
      });
    } catch (err: any) {
      alert(err.message || "Failed to move card");
    }
  };

  const onDropColumn = async (e: React.DragEvent, targetColumnId: number) => {
    e.preventDefault();
    const cardIdStr = e.dataTransfer.getData("text/plain");
    const cardId = parseInt(cardIdStr, 10);
    if (isNaN(cardId)) return;

    const targetCol = columns?.find((col: any) => col.id === targetColumnId);
    if (!targetCol) return;
    const cards = targetCol.cards || [];

    // If already the last card in this column, do nothing
    if (cards.length > 0 && cards[cards.length - 1].id === cardId) {
      return;
    }

    let afterCardId: number | undefined = undefined;
    if (cards.length > 0) {
      afterCardId = cards[cards.length - 1].id;
    }

    try {
      await moveCardOptimistically({
        cardId,
        targetColumnId,
        afterCardId,
        beforeCardId: undefined,
      });
    } catch (err: any) {
      alert(err.message || "Failed to move card");
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading your board...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-container">
        <p style={{ color: "#ef4444", fontWeight: "bold" }}>Error loading board: {error.message}</p>
      </div>
    );
  }

  const username = getUsername(user) || "User";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header className="app-header">
        <div className="app-title">
          📋 <span>Kanban Board</span>
        </div>
        <div className="user-info">
          <span className="username">Logged in as: <strong>{username}</strong></span>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="board-container">
        <div className="board-controls">
          <form onSubmit={handleCreateColumn} className="add-col-form">
            <input
              type="text"
              placeholder="New column title..."
              value={newColumnTitle}
              onChange={(e) => setNewColumnTitle(e.target.value)}
              className="add-col-input"
            />
            <button type="submit" className="add-col-btn">Add Column</button>
          </form>
        </div>

        <div className="board-columns">
          {columns?.map((col: any) => {
            const cards = col.cards || [];
            return (
              <div
                key={col.id}
                className="column"
                onDragOver={onDragOver}
                onDrop={(e) => onDropColumn(e, col.id)}
              >
                <div className="column-header">
                  <h3 className="column-title">{col.title}</h3>
                  <span className="card-count">{cards.length}</span>
                </div>

                <div className="cards-list">
                  {cards.map((card: any) => (
                    <div
                      key={card.id}
                      draggable="true"
                      onDragStart={(e) => onDragStart(e, card.id)}
                      onDragEnd={onDragEnd}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDropCard(e, card, col.id)}
                      className={`card ${draggedCardId === card.id ? "dragging" : ""}`}
                    >
                      <div className="card-title">{card.title}</div>
                    </div>
                  ))}
                </div>

                <div className="add-card-container">
                  <form
                    onSubmit={(e) => handleCreateCard(e, col.id, cards)}
                    className="add-card-form"
                  >
                    <input
                      type="text"
                      placeholder="New card title..."
                      value={newCardTitles[col.id] || ""}
                      onChange={(e) => setNewCardTitles(prev => ({ ...prev, [col.id]: e.target.value }))}
                      className="add-card-input"
                    />
                    <button type="submit" className="add-card-btn">Add Card</button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
