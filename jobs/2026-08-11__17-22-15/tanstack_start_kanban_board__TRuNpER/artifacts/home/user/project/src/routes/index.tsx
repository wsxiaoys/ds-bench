import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { getBoardStateFn, moveCardFn } from '../serverFunctions'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'

export const Route = createFileRoute('/')({
  component: BoardComponent,
})

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

function BoardComponent() {
  const queryClient = useQueryClient()

  const { data: queryData, isLoading, error } = useQuery({
    queryKey: ['board'],
    queryFn: () => getBoardStateFn(),
  })

  const [columns, setColumns] = useState<Column[]>([])

  useEffect(() => {
    if (queryData) {
      setColumns(queryData.columns)
    }
  }, [queryData])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const moveCardMutation = useMutation({
    mutationFn: moveCardFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['board'] })
    },
  })

  if (isLoading) {
    return (
      <div className="kanban-container">
        <header className="header">
          <h1 className="header-title">Kanban Board</h1>
        </header>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <p style={{ fontSize: '1.2rem', color: '#6b7280' }}>Loading board...</p>
        </div>
      </div>
    )
  }

  if (error || !queryData) {
    return (
      <div className="kanban-container">
        <header className="header">
          <h1 className="header-title">Kanban Board</h1>
        </header>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
          <p style={{ fontSize: '1.2rem', color: '#ef4444' }}>Error loading board</p>
        </div>
      </div>
    )
  }

  function findContainer(id: string | number, columnsList: Column[]) {
    if (columnsList.some(col => col.id === id)) {
      return id as string
    }
    const col = columnsList.find(col => col.cards.some(card => card.id === Number(id)))
    return col ? col.id : null
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id
    const overId = over.id

    if (activeId === overId) return

    const activeContainer = findContainer(activeId, columns)
    const overContainer = findContainer(overId, columns)

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return
    }

    setColumns(prev => {
      const activeCol = prev.find(c => c.id === activeContainer)!
      const overCol = prev.find(c => c.id === overContainer)!

      const activeCardIndex = activeCol.cards.findIndex(c => c.id === Number(activeId))
      if (activeCardIndex === -1) return prev

      const activeCard = activeCol.cards[activeCardIndex]

      let overCardIndex = overCol.cards.findIndex(c => c.id === Number(overId))
      if (overCardIndex === -1) {
        overCardIndex = overCol.cards.length
      }

      const newActiveCards = activeCol.cards.filter(c => c.id !== Number(activeId))
      const newOverCards = [...overCol.cards]
      newOverCards.splice(overCardIndex, 0, activeCard)

      return prev.map(col => {
        if (col.id === activeContainer) {
          return {
            ...col,
            cards: newActiveCards.map((c, i) => ({ ...c, position: i }))
          }
        }
        if (col.id === overContainer) {
          return {
            ...col,
            cards: newOverCards.map((c, i) => ({ ...c, position: i }))
          }
        }
        return col
      })
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) {
      setColumns(queryData.columns)
      return
    }

    const activeId = active.id
    const overId = over.id

    const activeContainer = findContainer(activeId, columns)
    const overContainer = findContainer(overId, columns)

    if (!activeContainer || !overContainer) {
      setColumns(queryData.columns)
      return
    }

    if (activeContainer === overContainer) {
      const col = columns.find(c => c.id === activeContainer)!
      const activeIndex = col.cards.findIndex(c => c.id === Number(activeId))
      const overIndex = col.cards.findIndex(c => c.id === Number(overId))

      if (activeIndex !== overIndex) {
        const reorderedCards = arrayMove(col.cards, activeIndex, overIndex).map((c, i) => ({
          ...c,
          position: i
        }))

        const updatedColumns = columns.map(c => {
          if (c.id === activeContainer) {
            return { ...c, cards: reorderedCards }
          }
          return c
        })

        setColumns(updatedColumns)

        try {
          await moveCardMutation.mutateAsync({
            cardId: Number(activeId),
            columnId: activeContainer,
            position: overIndex,
          })
        } catch (err) {
          console.error('Failed to move card:', err)
          setColumns(queryData.columns)
        }
      }
    } else {
      const col = columns.find(c => c.id === overContainer)!
      const activeIndex = col.cards.findIndex(c => c.id === Number(activeId))

      if (activeIndex !== -1) {
        try {
          await moveCardMutation.mutateAsync({
            cardId: Number(activeId),
            columnId: overContainer,
            position: activeIndex,
          })
        } catch (err) {
          console.error('Failed to move card:', err)
          setColumns(queryData.columns)
        }
      }
    }
  }

  return (
    <div className="kanban-container">
      <header className="header">
        <h1 className="header-title">Kanban Board</h1>
      </header>
      <main className="kanban-board">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {columns.map(col => (
            <SortableContext
              key={col.id}
              items={col.cards.map(c => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <ColumnContainer id={col.id} title={col.title}>
                {col.cards.map(card => (
                  <SortableCard key={card.id} card={card} />
                ))}
              </ColumnContainer>
            </SortableContext>
          ))}
        </DndContext>
      </main>
    </div>
  )
}

function ColumnContainer({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id })

  return (
    <div ref={setNodeRef} className="kanban-column">
      <h2 className="kanban-column-title">{title}</h2>
      <div className="kanban-cards-list">
        {children}
      </div>
    </div>
  )
}

function SortableCard({ card }: { card: Card }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id })

  const style = {
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
      className="kanban-card"
    >
      <p className="kanban-card-title">{card.title}</p>
    </div>
  )
}
