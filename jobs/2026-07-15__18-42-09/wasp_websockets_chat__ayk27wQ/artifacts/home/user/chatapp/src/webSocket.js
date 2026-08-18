export const webSocketFn = (io, context) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Send the full message history to the newly connected client only.
    context.entities.ChatMessage.findMany({
      orderBy: { createdAt: 'asc' },
    })
      .then((messages) => {
        socket.emit('messageHistory', messages);
      })
      .catch((err) => {
        console.error('Failed to load message history:', err);
        socket.emit('messageHistory', []);
      });

    socket.on('sendMessage', async (msg) => {
      try {
        const { username, text } = msg || {};
        if (typeof username !== 'string' || typeof text !== 'string') {
          console.warn('Invalid sendMessage payload:', msg);
          return;
        }
        // Persist the message, then broadcast it to every connected client.
        const created = await context.entities.ChatMessage.create({
          data: { username, text },
        });
        io.emit('newMessage', {
          id: created.id,
          username: created.username,
          text: created.text,
          createdAt: created.createdAt,
        });
      } catch (err) {
        console.error('Error handling sendMessage:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};
