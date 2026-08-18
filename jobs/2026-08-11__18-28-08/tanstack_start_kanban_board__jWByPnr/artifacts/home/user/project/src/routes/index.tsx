import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getBoard, moveCardTransaction } from '../db'
import {
  DndContext,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import * as React from 'react'

export const getBoardFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    return getBoard()
  })

export const moveCardFn = createServerFn({ method: 'POST' })
  .validator((data: { cardId: number; targetCol: string; targetPos: number }) => data)
  .handler(async ({ data }) => {
    moveCardTransaction(data.cardId, data.targetCol, data.targetPos)
    return { success: true }
  })

export const Route = createFileRoute('/')({
  component: Home,
})

function SortableCard({ id, title }: { id: number; title: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`card ${isDragging ? 'dragging' : ''}`}
    >
      <div className="card-title">{title}</div>
    </div>
  )
}

interface ColumnProps {
  id: string
  title: string
  cards: { id: number; title: string; position: number }[]
}

function Column({ id, title, cards }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div ref={setNodeRef} className="column">
      <div className="column-header">
        <span className="column-title">{title}</span>
        <span className="column-count">{cards.length}</span>
      </div>
      <SortableContext items={cards.map(c => c.id)} strategy={verticalListSortingStrategy}>
        <div className="card-list">
          {cards.map(card => (
            <SortableCard key={card.id} id={card.id} title={card.title} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

function Home() {
  const queryClient = useQueryClient()

  const { data: board, isLoading, error } = useQuery({
    queryKey: ['board'],
    queryFn: () => getBoardFn(),
  })

  const moveCardMutation = useMutation({
    mutationFn: (variables: { cardId: number; targetCol: string; targetPos: number }) => moveCardFn({ data: variables }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['board'] })
      const previousBoard = queryClient.getQueryData(['board'])

      queryClient.setQueryData(['board'], (old: any) => {
        if (!old) return old

        const newColumns = old.columns.map((col: any) => ({
          ...col,
          cards: [...col.cards]
        }))

        let movedCard: any = null
        let sourceColId = ''

        for (const col of newColumns) {
          const idx = col.cards.findIndex((c: any) => c.id === variables.cardId)
          if (idx !== -1) {
            movedCard = col.cards[idx]
            sourceColId = col.id
            col.cards.splice(idx, 1)
            break
          }
        }

        if (!movedCard) return old

        const targetCol = newColumns.find((col: any) => col.id === variables.targetCol)
        if (!targetCol) return old

        const targetPos = Math.max(0, Math.min(variables.targetPos, targetCol.cards.length))
        targetCol.cards.splice(targetPos, 0, movedCard)

        // Reset positions
        const sourceCol = newColumns.find((col: any) => col.id === sourceColId)
        if (sourceCol) {
          sourceCol.cards = sourceCol.cards.map((c: any, index: number) => ({
            ...c,
            position: index
          }))
        }

        targetCol.cards = targetCol.cards.map((c: any, index: number) => ({
          ...c,
          position: index
        }))

        return {
          ...old,
          columns: newColumns
        }
      })

      return { previousBoard }
    },
    onError: (err, variables, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(['board'], context.previousBoard)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['board'] })
    }
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const activeCardId = active.id as number
    
    // Find active card's column in current board state
    if (!board) return
    let sourceColId = ''
    for (const col of board.columns) {
      if (col.cards.some(c => c.id === activeCardId)) {
        sourceColId = col.id
        break
      }
    }
    if (!sourceColId) return

    let targetColId = ''
    let targetPos = 0

    // If over.id is a column ID
    if (over.id === 'todo' || over.id === 'in-progress' || over.id === 'done') {
      targetColId = over.id
      const targetCol = board.columns.find(col => col.id === targetColId)
      targetPos = targetCol ? targetCol.cards.length : 0
    } else {
      // over.id is a card ID
      const overCardId = over.id as number
      let overCard: any = null
      let overCol: any = null

      for (const col of board.columns) {
        const found = col.cards.find(c => c.id === overCardId)
        if (found) {
          overCard = found
          overCol = col
          break
        }
      }

      if (!overCol || !overCard) return

      targetColId = overCol.id
      
      const overIndex = overCol.cards.findIndex((c: any) => c.id === overCardId)
      targetPos = overIndex
    }

    // Call mutation
    moveCardMutation.mutate({
      cardId: activeCardId,
      targetCol: targetColId,
      targetPos: targetPos,
    })
  }

  if (isLoading) {
    return (
      <div className="app-container">
        <header>
          <h1>Full-Stack Kanban Board</h1>
          <p>Loading board state...</p>
        </header>
      </div>
    )
  }

  if (error || !board) {
    return (
      <div className="app-container">
        <header>
          <h1>Full-Stack Kanban Board</h1>
          <p style={{ color: 'red' }}>Error loading board state</p>
        </header>
      </div>
    )
  }

  return (
    <div className="app-container">
      <header>
        <h1>Full-Stack Kanban Board</h1>
        <p>Drag and drop cards to organize your workflow</p>
      </header>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="board">
          {board.columns.map(col => (
            <Column key={col.id} id={col.id} title={col.title} cards={col.cards} />
          ))}
        </div>
      </DndContext>
    </div>
  )
}
