import { useState } from "react";
import { useAuth, logout } from "wasp/client/auth";
import { useQuery, useAction } from "wasp/client/operations";
import { getBoard, createColumn, createCard, moveCard } from "wasp/client/operations";
import Logo from "./assets/wasp-logo-rounded.svg";
import "./Main.css";

export function MainPage() {
  const { data: user } = useAuth();
  const { data: columns, isLoading, error } = useQuery(getBoard);

  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newCardTitles, setNewCardTitles] = useState<Record<number, string>>({});

  // Setup the optimistic action for moving cards
  const moveCardOptimistically = useAction(moveCard, {
    optimisticUpdates: [
      {
        getQuerySpecifier: () => [getBoard],
        updateQuery: (args, oldBoard: any) => {
          if (!oldBoard) return oldBoard;
          const { cardId, targetColumnId, afterCardId, beforeCardId } = args;

          // Find the original card and its details
          let originalCard: any = null;
          for (const col of oldBoard) {
            const found = col.cards?.find((c: any) => c.id === cardId);
            if (found) {
              originalCard = found;
              break;
            }
          }
          if (!originalCard) return oldBoard;

          const targetCol = oldBoard.find((col: any) => col.id === targetColumnId);
          if (!targetCol) return oldBoard;

          const afterCard = afterCardId ? targetCol.cards?.find((c: any) => c.id === afterCardId) : null;
          const beforeCard = beforeCardId ? targetCol.cards?.find((c: any) => c.id === beforeCardId) : null;

          let newPosition: number;
          if (afterCard && beforeCard) {
            newPosition = (afterCard.position + beforeCard.position) / 2.0;
          } else if (afterCard) {
            newPosition = afterCard.position + 1.0;
          } else if (beforeCard) {
            newPosition = beforeCard.position - 1.0;
          } else {
            newPosition = 1.0;
          }

          const updatedCard = {
            ...originalCard,
            columnId: targetColumnId,
            position: newPosition,
          };

          return oldBoard.map((col: any) => {
            // Remove from source column if leaving
            if (col.id === originalCard.columnId && col.id !== targetColumnId) {
              return {
                ...col,
                cards: (col.cards || []).filter((c: any) => c.id !== cardId),
              };
            }
            // Add/update in target column
            if (col.id === targetColumnId) {
              const otherCards = (col.cards || []).filter((c: any) => c.id !== cardId);
              const updatedCards = [...otherCards, updatedCard].sort((a: any, b: any) => a.position - b.position);
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

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnTitle.trim() || !columns) return;

    try {
      const nextPos = columns.length > 0 ? Math.max(...columns.map((c: any) => c.position)) + 1.0 : 1.0;
      await createColumn({ title: newColumnTitle, position: nextPos });
      setNewColumnTitle("");
    } catch (err: any) {
      alert("Failed to create column: " + err.message);
    }
  };

  const handleCreateCard = async (columnId: number) => {
    const title = newCardTitles[columnId];
    if (!title || !title.trim() || !columns) return;

    try {
      const targetCol = columns.find((c: any) => c.id === columnId);
      const nextPos = (targetCol && targetCol.cards && targetCol.cards.length > 0)
        ? Math.max(...targetCol.cards.map((c: any) => c.position)) + 1.0
        : 1.0;

      await createCard({ title, columnId, position: nextPos });
      setNewCardTitles(prev => ({ ...prev, [columnId]: "" }));
    } catch (err: any) {
      alert("Failed to create card: " + err.message);
    }
  };

  const handleMoveCard = async (card: any, targetColumnId: number, afterCardId?: number, beforeCardId?: number) => {
    try {
      await moveCardOptimistically({
        cardId: card.id,
        targetColumnId,
        afterCardId,
        beforeCardId,
      });
    } catch (err: any) {
      alert("Failed to move card: " + err.message);
    }
  };

  const moveCardInDirection = (card: any, direction: "up" | "down" | "left" | "right") => {
    if (!columns) return;

    const colIndex = columns.findIndex((col: any) => col.id === card.columnId);
    if (colIndex === -1) return;

    const col = columns[colIndex];
    const cards = col.cards || [];
    const cardIndex = cards.findIndex((c: any) => c.id === card.id);
    if (cardIndex === -1) return;

    if (direction === "up") {
      if (cardIndex === 0) return; // Already at top
      const prevCard = cards[cardIndex - 1];
      if (cardIndex - 1 === 0) {
        handleMoveCard(card, col.id, undefined, prevCard.id);
      } else {
        const prevPrevCard = cards[cardIndex - 2];
        handleMoveCard(card, col.id, prevPrevCard.id, prevCard.id);
      }
    } else if (direction === "down") {
      if (cardIndex === cards.length - 1) return; // Already at bottom
      const nextCard = cards[cardIndex + 1];
      if (cardIndex + 1 === cards.length - 1) {
        handleMoveCard(card, col.id, nextCard.id, undefined);
      } else {
        const nextNextCard = cards[cardIndex + 2];
        handleMoveCard(card, col.id, nextCard.id, nextNextCard.id);
      }
    } else if (direction === "left") {
      if (colIndex === 0) return; // Already leftmost column
      const targetCol = columns[colIndex - 1];
      const targetCards = targetCol.cards || [];
      if (targetCards.length === 0) {
        handleMoveCard(card, targetCol.id);
      } else {
        const lastCard = targetCards[targetCards.length - 1];
        handleMoveCard(card, targetCol.id, lastCard.id, undefined);
      }
    } else if (direction === "right") {
      if (colIndex === columns.length - 1) return; // Already rightmost column
      const targetCol = columns[colIndex + 1];
      const targetCards = targetCol.cards || [];
      if (targetCards.length === 0) {
        handleMoveCard(card, targetCol.id);
      } else {
        const lastCard = targetCards[targetCards.length - 1];
        handleMoveCard(card, targetCol.id, lastCard.id, undefined);
      }
    }
  };

  const handleDropdownMove = (card: any, targetColumnId: number) => {
    if (!columns) return;
    if (targetColumnId === card.columnId) return;

    const targetCol = columns.find((col: any) => col.id === targetColumnId);
    if (!targetCol) return;

    const targetCards = targetCol.cards || [];
    if (targetCards.length === 0) {
      handleMoveCard(card, targetColumnId);
    } else {
      const lastCard = targetCards[targetCards.length - 1];
      handleMoveCard(card, targetColumnId, lastCard.id, undefined);
    }
  };

  const username = user?.identities?.username?.id || "User";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <header className="app-header">
        <div className="app-title-container">
          <img src={Logo} alt="Wasp Logo" className="app-logo" />
          <h1 className="app-title">Fractional Kanban</h1>
        </div>
        <div className="user-controls">
          <span className="username-display">Signed in as: <strong>{username}</strong></span>
          <button className="logout-button" onClick={logout}>Log Out</button>
        </div>
      </header>

      <div className="board-container">
        <div className="board-header">
          <p className="board-info">
            Manage columns and drag-free card reordering. Every card movement computes a new fractional floating-point position.
          </p>
        </div>

        {isLoading && (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading board data...</p>
          </div>
        )}

        {error && (
          <div className="loading-container">
            <p style={{ color: "#ef4444", fontWeight: "600" }}>Error loading board: {error.message}</p>
          </div>
        )}

        {!isLoading && !error && columns && (
          <div className="board-columns-wrapper">
            {columns.map((column: any, colIndex: number) => {
              const cards = column.cards || [];
              return (
                <div key={column.id} className="column-card">
                  <div className="column-header">
                    <h3 className="column-title">{column.title}</h3>
                    <span className="column-badge">{cards.length}</span>
                  </div>

                  <div className="column-cards-list">
                    {cards.length === 0 ? (
                      <div className="empty-column-placeholder">
                        No cards here yet
                      </div>
                    ) : (
                      cards.map((card: any, cardIndex: number) => (
                        <div key={card.id} className="kanban-card">
                          <div className="card-title">{card.title}</div>
                          <div className="card-controls">
                            <div className="direction-buttons">
                              <button
                                className="control-btn"
                                title="Move Left"
                                onClick={() => moveCardInDirection(card, "left")}
                                disabled={colIndex === 0}
                              >
                                ←
                              </button>
                              <button
                                className="control-btn"
                                title="Move Up"
                                onClick={() => moveCardInDirection(card, "up")}
                                disabled={cardIndex === 0}
                              >
                                ↑
                              </button>
                              <button
                                className="control-btn"
                                title="Move Down"
                                onClick={() => moveCardInDirection(card, "down")}
                                disabled={cardIndex === cards.length - 1}
                              >
                                ↓
                              </button>
                              <button
                                className="control-btn"
                                title="Move Right"
                                onClick={() => moveCardInDirection(card, "right")}
                                disabled={colIndex === columns.length - 1}
                              >
                                →
                              </button>
                            </div>

                            <select
                              className="column-select"
                              value={card.columnId}
                              onChange={(e) => handleDropdownMove(card, Number(e.target.value))}
                            >
                              <option value={card.columnId} disabled>Move to...</option>
                              {columns
                                .filter((c: any) => c.id !== card.columnId)
                                .map((c: any) => (
                                  <option key={c.id} value={c.id}>
                                    {c.title}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="add-card-form">
                    <input
                      type="text"
                      className="add-card-input"
                      placeholder="Add a card..."
                      value={newCardTitles[column.id] || ""}
                      onChange={(e) => setNewCardTitles(prev => ({ ...prev, [column.id]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreateCard(column.id);
                        }
                      }}
                    />
                    <button className="add-card-btn" onClick={() => handleCreateCard(column.id)}>
                      + Add Card
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="add-column-card">
              <h3 className="add-column-title">Create Column</h3>
              <form className="add-column-form" onSubmit={handleCreateColumn}>
                <input
                  type="text"
                  className="add-column-input"
                  placeholder="Column title..."
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                />
                <button type="submit" className="add-column-btn">
                  + Add Column
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
