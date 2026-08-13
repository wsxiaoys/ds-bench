import React, { useState } from "react";
import { useQuery, useAction, getBoard, createColumn, createCard, moveCard } from "wasp/client/operations";
import { logout } from "wasp/client/auth";
import type { AuthUser } from "wasp/auth";
import "./Main.css";

export function MainPage({ user }: { user: AuthUser }) {
  const { data: columns, isLoading, error } = useQuery(getBoard);
  const createColumnAction = useAction(createColumn);
  const createCardAction = useAction(createCard);
  
  const moveCardOptimistically = useAction(moveCard, {
    optimisticUpdates: [
      {
        getQuerySpecifier: () => [getBoard],
        updateQuery: (payload, oldData) => {
          if (!oldData) return oldData;
          const { cardId, targetColumnId, afterCardId, beforeCardId } = payload;

          // Find the card being moved
          let movedCard: any = null;
          for (const col of oldData) {
            const found = col.cards?.find((c: any) => c.id === cardId);
            if (found) {
              movedCard = { ...found };
              break;
            }
          }

          if (!movedCard) return oldData;

          // Filter out the moved card from all columns first
          const nextData = oldData.map((col: any) => ({
            ...col,
            cards: col.cards ? col.cards.filter((c: any) => c.id !== cardId) : []
          }));

          // Get the target cards (without the moved card)
          const targetColInNext = nextData.find((col: any) => col.id === targetColumnId);
          const targetCards = targetColInNext ? targetColInNext.cards : [];

          // Find afterCard and beforeCard in targetCards
          const afterCard = afterCardId ? targetCards.find((c: any) => c.id === afterCardId) : null;
          const beforeCard = beforeCardId ? targetCards.find((c: any) => c.id === beforeCardId) : null;

          let newPosition;
          if (afterCard && beforeCard) {
            newPosition = (afterCard.position + beforeCard.position) / 2;
          } else if (afterCard) {
            newPosition = afterCard.position + 1.0;
          } else if (beforeCard) {
            newPosition = beforeCard.position - 1.0;
          } else {
            newPosition = 1.0;
          }

          // Update the moved card's properties
          movedCard.columnId = targetColumnId;
          movedCard.position = newPosition;

          // Insert the moved card into target column's cards and sort them by position
          return nextData.map((col: any) => {
            if (col.id === targetColumnId) {
              const updatedCards = [...col.cards, movedCard].sort((a, b) => a.position - b.position);
              return { ...col, cards: updatedCards };
            }
            return col;
          });
        }
      }
    ]
  });

  const [newColTitle, setNewColTitle] = useState("");
  const [newCardTitles, setNewCardTitles] = useState<Record<number, string>>({});

  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColTitle.trim()) return;
    const maxPosition = columns && columns.length > 0 ? Math.max(...columns.map((c: any) => c.position)) : 0;
    await createColumnAction({ title: newColTitle.trim(), position: maxPosition + 1.0 });
    setNewColTitle("");
  };

  const handleCreateCard = async (columnId: number) => {
    const title = newCardTitles[columnId] || "";
    if (!title.trim()) return;
    const col = columns?.find((c: any) => c.id === columnId);
    const cards = col?.cards || [];
    const maxPosition = cards.length > 0 ? Math.max(...cards.map((c: any) => c.position)) : 0;
    await createCardAction({ title: title.trim(), columnId, position: maxPosition + 1.0 });
    setNewCardTitles({ ...newCardTitles, [columnId]: "" });
  };

  const handleMoveCardUp = async (columnId: number, cardIndex: number) => {
    const col = columns?.find((c: any) => c.id === columnId);
    if (!col || !col.cards || cardIndex <= 0) return;
    const card = col.cards[cardIndex];
    const prevCard = col.cards[cardIndex - 1];
    const prevPrevCard = cardIndex > 1 ? col.cards[cardIndex - 2] : null;

    await moveCardOptimistically({
      cardId: card.id,
      targetColumnId: columnId,
      afterCardId: prevPrevCard ? prevPrevCard.id : null,
      beforeCardId: prevCard.id
    });
  };

  const handleMoveCardDown = async (columnId: number, cardIndex: number) => {
    const col = columns?.find((c: any) => c.id === columnId);
    if (!col || !col.cards || cardIndex >= col.cards.length - 1) return;
    const card = col.cards[cardIndex];
    const nextCard = col.cards[cardIndex + 1];
    const nextNextCard = cardIndex < col.cards.length - 2 ? col.cards[cardIndex + 2] : null;

    await moveCardOptimistically({
      cardId: card.id,
      targetColumnId: columnId,
      afterCardId: nextCard.id,
      beforeCardId: nextNextCard ? nextNextCard.id : null
    });
  };

  const handleMoveCardToColumn = async (cardId: number, targetColId: number) => {
    const targetCol = columns?.find((c: any) => c.id === targetColId);
    if (!targetCol) return;
    const cards = targetCol.cards || [];
    const lastCard = cards.length > 0 ? cards[cards.length - 1] : null;

    await moveCardOptimistically({
      cardId,
      targetColumnId: targetColId,
      afterCardId: lastCard ? lastCard.id : null,
      beforeCardId: null
    });
  };

  if (isLoading) return <div className="loading">Loading board...</div>;
  if (error) return <div className="error">Error loading board: {error.message}</div>;

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="header-title">Fractional Kanban</h1>
        <div className="user-info">
          <span className="username">Welcome, <strong>{user.identities?.username?.id || "User"}</strong></span>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </header>

      <main className="board-container">
        <div className="columns-list">
          {columns?.map((col: any) => (
            <div key={col.id} className="board-column">
              <h3 className="column-title">{col.title}</h3>
              
              <div className="cards-list">
                {col.cards?.map((card: any, index: number) => (
                  <div key={card.id} className="card-item">
                    <div className="card-title">{card.title}</div>
                    <div className="card-controls">
                      <div className="reorder-btns">
                        <button 
                          disabled={index === 0} 
                          onClick={() => handleMoveCardUp(col.id, index)}
                          title="Move Up"
                          className="reorder-btn"
                        >
                          ▲
                        </button>
                        <button 
                          disabled={index === col.cards.length - 1} 
                          onClick={() => handleMoveCardDown(col.id, index)}
                          title="Move Down"
                          className="reorder-btn"
                        >
                          ▼
                        </button>
                      </div>
                      <select 
                        value={col.id} 
                        onChange={(e) => handleMoveCardToColumn(card.id, Number(e.target.value))}
                        className="move-select"
                      >
                        <option value={col.id} disabled>Move to...</option>
                        {columns
                          .filter((c: any) => c.id !== col.id)
                          .map((c: any) => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="add-card-form">
                <input 
                  type="text" 
                  placeholder="New card..." 
                  value={newCardTitles[col.id] || ""}
                  onChange={(e) => setNewCardTitles({ ...newCardTitles, [col.id]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateCard(col.id);
                  }}
                  className="card-input"
                />
                <button onClick={() => handleCreateCard(col.id)} className="add-card-btn">Add Card</button>
              </div>
            </div>
          ))}

          <div className="add-column-card">
            <form onSubmit={handleCreateColumn} className="add-column-form">
              <input 
                type="text" 
                placeholder="New column title..." 
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                className="column-input"
              />
              <button type="submit" className="add-column-btn">Add Column</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
