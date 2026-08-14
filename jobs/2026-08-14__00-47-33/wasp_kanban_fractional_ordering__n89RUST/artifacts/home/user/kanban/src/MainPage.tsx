import { useQuery, useAction, getBoard, createColumn, createCard, moveCard } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import { getUsername } from "wasp/auth";
import type { AuthUser } from "wasp/auth";
import { useState } from "react";
import "./Main.css";

export function MainPage({ user }: { user: AuthUser }) {
  const { data: columns, isLoading, error } = useQuery(getBoard);

  const createColumnAction = useAction(createColumn);
  const createCardAction = useAction(createCard);
  const moveCardAction = useAction(moveCard, {
    optimisticUpdates: [
      {
        getQuerySpecifier: () => [getBoard],
        updateQuery: (args, oldColumns) => {
          if (!oldColumns) return oldColumns;

          const { cardId, targetColumnId, afterCardId, beforeCardId } = args;

          // 1. Find the card to be moved across all columns
          let movedCard: any = null;
          for (const col of oldColumns) {
            const c = col.cards.find((card: any) => card.id === cardId);
            if (c) {
              movedCard = { ...c };
              break;
            }
          }

          if (!movedCard) return oldColumns;

          // 2. Remove the card from its old column
          const nextColumns = oldColumns.map((col: any) => {
            return {
              ...col,
              cards: col.cards.filter((card: any) => card.id !== cardId),
            };
          });

          // 3. Compute the new position for the moved card in the target column
          const targetCol = nextColumns.find((col: any) => col.id === targetColumnId);
          if (!targetCol) return oldColumns;

          let afterCard: any = null;
          if (afterCardId !== undefined && afterCardId !== null) {
            afterCard = targetCol.cards.find((card: any) => card.id === afterCardId);
          }

          let beforeCard: any = null;
          if (beforeCardId !== undefined && beforeCardId !== null) {
            beforeCard = targetCol.cards.find((card: any) => card.id === beforeCardId);
          }

          let newPosition: number;
          if (afterCard && beforeCard) {
            newPosition = (afterCard.position + beforeCard.position) / 2;
          } else if (afterCard) {
            newPosition = afterCard.position + 1.0;
          } else if (beforeCard) {
            newPosition = beforeCard.position - 1.0;
          } else {
            newPosition = 1.0;
          }

          // Update the moved card's position and columnId
          movedCard.position = newPosition;
          movedCard.columnId = targetColumnId;

          // 4. Insert the card into the target column and sort its cards by position
          return nextColumns.map((col: any) => {
            if (col.id === targetColumnId) {
              const updatedCards = [...col.cards, movedCard];
              updatedCards.sort((a: any, b: any) => a.position - b.position);
              return {
                ...col,
                cards: updatedCards,
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

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnTitle.trim()) return;

    // Determine position for new column
    const maxPosition = columns && columns.length > 0
      ? Math.max(...columns.map((c: any) => c.position))
      : 0.0;
    const newPosition = maxPosition + 1.0;

    try {
      await createColumnAction({ title: newColumnTitle.trim(), position: newPosition });
      setNewColumnTitle("");
    } catch (err: any) {
      alert("Failed to create column: " + err.message);
    }
  };

  const handleCreateCard = async (e: React.FormEvent, columnId: number) => {
    e.preventDefault();
    const title = newCardTitles[columnId] || "";
    if (!title.trim()) return;

    const column = columns?.find((c: any) => c.id === columnId);
    const maxPosition = column && column.cards.length > 0
      ? Math.max(...column.cards.map((c: any) => c.position))
      : 0.0;
    const newPosition = maxPosition + 1.0;

    try {
      await createCardAction({ title: title.trim(), columnId, position: newPosition });
      setNewCardTitles((prev) => ({ ...prev, [columnId]: "" }));
    } catch (err: any) {
      alert("Failed to create card: " + err.message);
    }
  };

  // Helper to trigger moveCard action
  const handleMoveCard = async (
    cardId: number,
    targetColumnId: number,
    afterCardId: number | null,
    beforeCardId: number | null
  ) => {
    try {
      await moveCardAction({ cardId, targetColumnId, afterCardId, beforeCardId });
    } catch (err: any) {
      alert("Failed to move card: " + err.message);
    }
  };

  // Button-based movement helpers
  const moveCardLeft = (cardId: number, currentColumnId: number) => {
    if (!columns) return;
    const colIndex = columns.findIndex((c: any) => c.id === currentColumnId);
    if (colIndex <= 0) return; // No column to the left

    const targetCol = columns[colIndex - 1];
    const targetCards = targetCol.cards;
    const afterCardId = targetCards.length > 0 ? targetCards[targetCards.length - 1].id : null;
    handleMoveCard(cardId, targetCol.id, afterCardId, null);
  };

  const moveCardRight = (cardId: number, currentColumnId: number) => {
    if (!columns) return;
    const colIndex = columns.findIndex((c: any) => c.id === currentColumnId);
    if (colIndex < 0 || colIndex >= columns.length - 1) return; // No column to the right

    const targetCol = columns[colIndex + 1];
    const targetCards = targetCol.cards;
    const afterCardId = targetCards.length > 0 ? targetCards[targetCards.length - 1].id : null;
    handleMoveCard(cardId, targetCol.id, afterCardId, null);
  };

  const moveCardUp = (cardId: number, columnId: number) => {
    if (!columns) return;
    const col = columns.find((c: any) => c.id === columnId);
    if (!col) return;

    const cardIndex = col.cards.findIndex((c: any) => c.id === cardId);
    if (cardIndex <= 0) return; // Already at the top

    const targetCards = col.cards.filter((c: any) => c.id !== cardId);
    const targetIndex = cardIndex - 1;

    let afterCardId: number | null = null;
    let beforeCardId: number | null = null;

    if (targetIndex === 0) {
      beforeCardId = targetCards[0].id;
    } else {
      afterCardId = targetCards[targetIndex - 1].id;
      beforeCardId = targetCards[targetIndex].id;
    }

    handleMoveCard(cardId, columnId, afterCardId, beforeCardId);
  };

  const moveCardDown = (cardId: number, columnId: number) => {
    if (!columns) return;
    const col = columns.find((c: any) => c.id === columnId);
    if (!col) return;

    const cardIndex = col.cards.findIndex((c: any) => c.id === cardId);
    if (cardIndex < 0 || cardIndex >= col.cards.length - 1) return; // Already at the bottom

    const targetCards = col.cards.filter((c: any) => c.id !== cardId);
    const targetIndex = cardIndex + 1;

    let afterCardId: number | null = null;
    let beforeCardId: number | null = null;

    if (targetIndex >= targetCards.length) {
      afterCardId = targetCards[targetCards.length - 1].id;
    } else {
      afterCardId = targetCards[targetIndex - 1].id;
      beforeCardId = targetCards[targetIndex].id;
    }

    handleMoveCard(cardId, columnId, afterCardId, beforeCardId);
  };

  // HTML5 Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, cardId: number) => {
    e.dataTransfer.setData("text/plain", cardId.toString());
  };

  const handleDragOverCard = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnCard = (e: React.DragEvent, targetCardId: number, targetColumnId: number) => {
    e.preventDefault();
    e.stopPropagation();

    const cardIdStr = e.dataTransfer.getData("text/plain");
    if (!cardIdStr) return;
    const draggedCardId = parseInt(cardIdStr, 10);
    if (draggedCardId === targetCardId) return;

    if (!columns) return;
    const targetCol = columns.find((c: any) => c.id === targetColumnId);
    if (!targetCol) return;

    const targetCards = targetCol.cards.filter((c: any) => c.id !== draggedCardId);
    const targetCardIdx = targetCards.findIndex((c: any) => c.id === targetCardId);
    if (targetCardIdx < 0) return;

    const targetIndex = targetCardIdx;
    let afterCardId: number | null = null;
    let beforeCardId: number | null = null;

    if (targetIndex === 0) {
      beforeCardId = targetCards[0].id;
    } else {
      afterCardId = targetCards[targetIndex - 1].id;
      beforeCardId = targetCards[targetIndex].id;
    }

    handleMoveCard(draggedCardId, targetColumnId, afterCardId, beforeCardId);
  };

  const handleDropOnColumn = (e: React.DragEvent, targetColumnId: number) => {
    e.preventDefault();
    const cardIdStr = e.dataTransfer.getData("text/plain");
    if (!cardIdStr) return;
    const draggedCardId = parseInt(cardIdStr, 10);

    if (!columns) return;
    const targetCol = columns.find((c: any) => c.id === targetColumnId);
    if (!targetCol) return;

    const targetCards = targetCol.cards.filter((c: any) => c.id !== draggedCardId);
    const afterCardId = targetCards.length > 0 ? targetCards[targetCards.length - 1].id : null;

    handleMoveCard(draggedCardId, targetColumnId, afterCardId, null);
  };

  const username = getUsername(user);

  if (isLoading) {
    return <div className="loading">Loading board...</div>;
  }

  if (error) {
    return <div className="error">Error loading board: {error.message}</div>;
  }

  return (
    <div className="kanban-app">
      <header className="kanban-header">
        <div className="header-left">
          <h1>Kanban Board</h1>
          {username && <span className="user-welcome">Logged in as: <strong>{username}</strong></span>}
        </div>
        <button className="logout-btn" onClick={logout}>Logout</button>
      </header>

      <main className="kanban-main">
        {/* Create Column Section */}
        <div className="create-column-container">
          <form onSubmit={handleCreateColumn} className="create-column-form">
            <input
              type="text"
              placeholder="New Column Title..."
              value={newColumnTitle}
              onChange={(e) => setNewColumnTitle(e.target.value)}
              className="column-input"
            />
            <button type="submit" className="column-submit-btn">Create Column</button>
          </form>
        </div>

        {/* Columns Grid */}
        <div className="board-columns">
          {columns && columns.map((col: any, colIdx: number) => (
            <div
              key={col.id}
              className="column-card"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDropOnColumn(e, col.id)}
            >
              <div className="column-header">
                <h2>{col.title}</h2>
                <span className="card-count">{col.cards.length}</span>
              </div>

              {/* Cards List */}
              <div className="column-cards-list">
                {col.cards.map((card: any, cardIdx: number) => (
                  <div
                    key={card.id}
                    className="card-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id)}
                    onDragOver={handleDragOverCard}
                    onDrop={(e) => handleDropOnCard(e, card.id, col.id)}
                  >
                    <div className="card-content">
                      <p className="card-title">{card.title}</p>
                    </div>

                    {/* Card Actions / Movement Controls */}
                    <div className="card-controls">
                      <div className="control-group">
                        <button
                          className="control-btn"
                          onClick={() => moveCardLeft(card.id, col.id)}
                          disabled={colIdx === 0}
                          title="Move Left"
                        >
                          ←
                        </button>
                        <button
                          className="control-btn"
                          onClick={() => moveCardUp(card.id, col.id)}
                          disabled={cardIdx === 0}
                          title="Move Up"
                        >
                          ↑
                        </button>
                        <button
                          className="control-btn"
                          onClick={() => moveCardDown(card.id, col.id)}
                          disabled={cardIdx === col.cards.length - 1}
                          title="Move Down"
                        >
                          ↓
                        </button>
                        <button
                          className="control-btn"
                          onClick={() => moveCardRight(card.id, col.id)}
                          disabled={colIdx === columns.length - 1}
                          title="Move Right"
                        >
                          →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Card Form inside Column */}
              <form onSubmit={(e) => handleCreateCard(e, col.id)} className="create-card-form">
                <input
                  type="text"
                  placeholder="Add a card..."
                  value={newCardTitles[col.id] || ""}
                  onChange={(e) =>
                    setNewCardTitles((prev) => ({ ...prev, [col.id]: e.target.value }))
                  }
                  className="card-input"
                />
                <button type="submit" className="card-submit-btn">+</button>
              </form>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
