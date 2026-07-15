import { useState } from 'react'
import { useSocket, useSocketListener } from 'wasp/client/webSocket'
import './Main.css'

export const MainPage = () => {
  const { socket, isConnected } = useSocket()
  const [username, setUsername] = useState('')
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([])

  useSocketListener('messageHistory', (history) => {
    setMessages(history)
  })

  useSocketListener('newMessage', (msg) => {
    setMessages((prevMessages) => [...prevMessages, msg])
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !text.trim()) {
      return
    }
    socket.emit('sendMessage', { username, text })
    setText('')
  }

  return (
    <div className="container">
      <main>
        <h2 className="welcome-title">Group Chat</h2>
        <p>
          Status:{' '}
          <strong style={{ color: isConnected ? 'green' : 'red' }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </strong>
        </p>

        <div
          style={{
            border: '1px solid #ccc',
            borderRadius: 8,
            height: 320,
            overflowY: 'auto',
            padding: 12,
            marginBottom: 12,
            textAlign: 'left',
          }}
        >
          {messages.length === 0 && <p>No messages yet. Say hi!</p>}
          {messages.map((msg) => (
            <div key={msg.id} style={{ marginBottom: 6 }}>
              <strong>{msg.username}: </strong>
              <span>{msg.text}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ flex: '0 0 150px' }}
          />
          <input
            type="text"
            placeholder="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit">Send</button>
        </form>
      </main>
    </div>
  )
}
