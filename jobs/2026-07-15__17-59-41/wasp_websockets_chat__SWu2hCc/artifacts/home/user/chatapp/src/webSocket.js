export const webSocketFn = (io, context) => {
  // When a new client connects, send it the full message history
  // (oldest first) from the database, and register per-socket event
  // handlers for inbound messages.
  io.on('connection', async (socket) => {
    console.log('a user connected')

    // Send the full message history only to the connecting socket.
    const messages = await context.entities.ChatMessage.findMany({
      orderBy: { createdAt: 'asc' },
    })

    const messageHistory = messages.map((msg) => ({
      id: msg.id,
      username: msg.username,
      text: msg.text,
      createdAt: msg.createdAt,
    }))

    socket.emit('messageHistory', messageHistory)

    // When a client sends a message, persist it and broadcast it to
    // every connected client (including the sender).
    socket.on('sendMessage', async (payload) => {
      const { username, text } = payload

      // Persist the message to the database.
      const createdMessage = await context.entities.ChatMessage.create({
        data: {
          username,
          text,
        },
      })

      // Broadcast the persisted message to all connected clients.
      io.emit('newMessage', {
        id: createdMessage.id,
        username: createdMessage.username,
        text: createdMessage.text,
        createdAt: createdMessage.createdAt,
      })
    })
  })
}