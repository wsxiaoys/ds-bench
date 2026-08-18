import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DndContext, useSensor, useSensors, PointerSensor, useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'

// Define interfaces
interface Card {
  id: number
  title: string
  position: number
}

interface Column {
  id: string
  title: string
  cards: Card[]
}

interface BoardData {
  columns: Column[]
}

// Server function to get the board
export const getBoardFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { getBoard } = await import('../db.server')
  return getBoard()
})

// Server function to move a card
export const moveCardFn = createServerFn({ method: 'POST' })
  .validator((data: { cardId: number; toColumn: string; toPosition: number }) => data)
  .handler(async ({ data }) => {
    const { moveCard } = await import('../db.server')
    moveCard(data.cardId, data.toColumn, data.toPosition)
    return { success: true }
  })

export const Route = createFileRoute('/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData({
      queryKey: ['board'],
      queryFn: () => getBoardFn(),
    })
  },
  component: BoardPage,
})

function SortableCard({ card }: { card: Card }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="card"
    >
      {card.title}
    </div>
  )
}

function ColumnComponent({ column }: { column: Column }) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  })

  return (
    <div ref={setNodeRef} className="column">
      <h2 className="column-title">{column.title}</h2>
      <SortableContext
        items={column.cards.map(c => c.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="card-list">
          {column.cards.map(card => (
            <SortableCard key={card.id} card={card} />
          ))}
          {column.cards.length === 0 && (
            <div className="empty-placeholder">
              Drag cards here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

function BoardPage() {
  const queryClient = useQueryClient()
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const { data: board } = useQuery<BoardData>({
    queryKey: ['board'],
    queryFn: () => getBoardFn(),
  })

  const moveCardMutation = useMutation({
    mutationFn: (variables: { cardId: number; toColumn: string; toPosition: number }) =>
      moveCardFn({ data: variables }),
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['board'] })

      // Snapshot previous value
      const previousBoard = queryClient.getQueryData<BoardData>(['board'])

      // Optimistically update to the new value
      if (previousBoard) {
        queryClient.setQueryData<BoardData>(['board'], () => {
          const activeCardId = variables.cardId
          const toColumn = variables.toColumn
          const toPosition = variables.toPosition

          let activeCard: Card | null = null
          let fromColumnId = ''
          for (const col of previousBoard.columns) {
            const card = col.cards.find(c => c.id === activeCardId)
            if (card) {
              activeCard = card
              fromColumnId = col.id
              break
            }
          }

          if (!activeCard) return previousBoard

          const sourceCards = previousBoard.columns
            .find(c => c.id === fromColumnId)!
            .cards.filter(c => c.id !== activeCardId)

          const destCards = fromColumnId === toColumn
            ? sourceCards
            : previousBoard.columns.find(c => c.id === toColumn)!.cards

          const targetPos = Math.max(0, Math.min(toPosition, destCards.length))
          const newDestCards = [...destCards]
          newDestCards.splice(targetPos, 0, { ...activeCard, position: targetPos })

          const updatedDestCards = newDestCards.map((c, i) => ({ ...c, position: i }))
          const updatedSourceCards = sourceCards.map((c, i) => ({ ...c, position: i }))

          const newColumns = previousBoard.columns.map(col => {
            if (col.id === toColumn) {
              return { ...col, cards: updatedDestCards }
            }
            if (fromColumnId !== toColumn && col.id === fromColumnId) {
              return { ...col, cards: updatedSourceCards }
            }
            return col
          })

          return { columns: newColumns }
        })
      }

      return { previousBoard }
    },
    onError: (err, variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(['board'], context.previousBoard)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['board'] })
    },
  })

  const handleDragEnd = (event: any) => {
    const { active, over } = event
    if (!over || !board) return

    const activeCardId = Number(active.id)
    const overId = over.id

    let toColumnId = ''
    let toPosition = 0

    if (overId === 'todo' || overId === 'in-progress' || overId === 'done') {
      toColumnId = overId
      const col = board.columns.find(c => c.id === toColumnId)
      toPosition = col ? col.cards.length : 0
    } else {
      const overCardId = Number(overId)
      for (const col of board.columns) {
        const idx = col.cards.findIndex(c => c.id === overCardId)
        if (idx !== -1) {
          toColumnId = col.id
          toPosition = idx
          break
        }
      }
    }

    if (!toColumnId) return

    // Find original position to see if anything changed
    let fromColumnId = ''
    let fromPosition = 0
    for (const col of board.columns) {
      const idx = col.cards.findIndex(c => c.id === activeCardId)
      if (idx !== -1) {
        fromColumnId = col.id
        fromPosition = idx
        break
      }
    }

    if (fromColumnId === toColumnId && fromPosition === toPosition) {
      return
    }

    moveCardMutation.mutate({ cardId: activeCardId, toColumn: toColumnId, toPosition })
  }

  if (!board) return <div className="loading">Loading board...</div>

  return (
    <div className="container">
      <header className="header">
        <h1>TanStack Start Kanban Board</h1>
      </header>
      <main className="board-wrapper">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="board">
            {board.columns.map(column => (
              <ColumnComponent key={column.id} column={column} />
            ))}
          </div>
        </DndContext>
      </main>
      <style>{`
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
        }
        .header {
          margin-bottom: 30px;
          text-align: center;
        }
        .header h1 {
          font-size: 2rem;
          color: #111827;
          margin: 0;
        }
        .board-wrapper {
          flex: 1;
          display: flex;
        }
        .board {
          display: flex;
          gap: 24px;
          width: 100%;
          align-items: flex-start;
        }
        .column {
          flex: 1;
          min-width: 280px;
          background-color: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          max-height: 80vh;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        }
        .column-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #374151;
          margin-top: 0;
          margin-bottom: 16px;
          border-bottom: 2px solid #f3f4f6;
          padding-bottom: 8px;
        }
        .card-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 200px;
          flex: 1;
        }
        .card {
          background-color: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          font-size: 0.95rem;
          font-weight: 500;
          color: #1f2937;
          user-select: none;
          transition: box-shadow 0.2s, border-color 0.2s;
        }
        .card:hover {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          border-color: #d1d5db;
        }
        .empty-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px dashed #e5e7eb;
          border-radius: 8px;
          padding: 24px;
          color: #9ca3af;
          font-size: 0.875rem;
          text-align: center;
          height: 100%;
          min-height: 100px;
        }
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-size: 1.25rem;
          color: #4b5563;
        }
      `}</style>
    </div>
  )
}
