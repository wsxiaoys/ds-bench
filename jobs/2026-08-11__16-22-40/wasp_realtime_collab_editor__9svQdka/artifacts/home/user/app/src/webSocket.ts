import { Server } from 'socket.io'

export let ioInstance: Server | null = null

export const webSocketFn = (io: Server, context: any) => {
  ioInstance = io

  io.on('connection', (socket) => {
    socket.on('joinDocument', async ({ documentId }) => {
      const roomId = `document-${documentId}`
      socket.join(roomId)
    })

    socket.on('documentEdit', async ({ documentId, content }) => {
      const roomId = `document-${documentId}`
      socket.to(roomId).emit('documentEdit', { content })
    })
  })
}
