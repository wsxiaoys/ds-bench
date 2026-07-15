import { useState } from 'react'
import { useSocket, useSocketListener } from 'wasp/client/webSocket'
import './Main.css'

export const MainPage = () => {
  const [username, setUsername] = useState('')
  const [messageText, setMessageText] = useState('')
  const [messages, setMessages] = useState([])

  const { socket, isConnected } = useSocket()

  // When the server sends the full message history (on connect),
  // replace our local list with it (oldest first).
  useSocketListener('messageHistory', (history) => {
    setMessages(history)
  })

  // When the server broadcasts a new persisted message, append it.
  useSocketListener('newMessage', (msg) => {
    setMessages((priorMessages) => [...priorMessages, msg])
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !messageText.trim()) return
    socket.emit('sendMessage', {
      username: username.trim(),
      text: messageText.trim(),
    })
    setMessageText('')
  }

  const connectionIcon = isConnected ? '🟢' : '🔴'
  const connectionLabel = isConnected ? 'Connected' : 'Disconnected'

  const messageList = messages.map((msg) => (
    <li key={msg.id} className="chat-message">
      <strong className="chat-username">{msg.username}</strong>
      <span className="chat-separator">: </span>
      <span className="chat-text">{msg.text}</span>
    </li>
  ))

  return (
    <div className="container">
      <main>
        <h2 className="welcome-title">Group Chat {connectionIcon}</h2>
        <h3 className="welcome-subtitle">
          Status: <code>{connectionLabel}</code>
        </h3>

        <div className="chat-form">
          <form onSubmit={handleSubmit}>
            <div className="chat-input-row">
              <input
                type="text"
                placeholder="Your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="chat-input-row">
              <input
                type="text"
                placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
              />
              <button type="submit">Send</button>
            </div>
          </form>
        </div>

        <ul className="chat-message-list">{messageList}</ul>
      </main>
    </div>
  )
}