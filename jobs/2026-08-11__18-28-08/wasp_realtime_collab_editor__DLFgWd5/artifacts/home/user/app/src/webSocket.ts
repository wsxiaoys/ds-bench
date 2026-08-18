import { setIO } from './serverIO'
import { type WebSocketDefinition } from 'wasp/server/webSocket'

export const webSocketFn: WebSocketDefinition = (io, context) => {
  setIO(io)

  io.on('connection', (socket) => {
    const user = socket.data.user
    console.log('A user connected:', user?.username || 'Anonymous')

    socket.on('joinDocument', async ({ documentId }) => {
      socket.join(`document-${documentId}`)
      console.log(`Socket joined room: document-${documentId}`)
    })

    socket.on('leaveDocument', ({ documentId }) => {
      socket.leave(`document-${documentId}`)
      console.log(`Socket left room: document-${documentId}`)
    })

    socket.on('editDocument', async ({ documentId, content }) => {
      if (!user) return

      try {
        const doc = await context.entities.Document.findUnique({
          where: { id: Number(documentId) },
          include: {
            permissions: {
              where: { userId: user.id }
            }
          }
        })

        if (!doc) return

        const isOwner = doc.ownerId === user.id
        const hasEditPermission = doc.permissions.some(p => p.role === 'EDIT')

        if (isOwner || hasEditPermission) {
          // Update database
          await context.entities.Document.update({
            where: { id: Number(documentId) },
            data: { content }
          })

          // Broadcast to all other clients in the document room
          socket.to(`document-${documentId}`).emit('documentEdited', { content })
        }
      } catch (error) {
        console.error('Error handling editDocument:', error)
      }
    })
  })
}
