import React, { useState } from 'react';
import { useSocket, useSocketListener } from 'wasp/client/webSocket';
import './Main.css';

export const MainPage = () => {
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [username, setUsername] = useState('');
  const [text, setText] = useState('');

  useSocketListener('messageHistory', (history) => {
    if (Array.isArray(history)) {
      setMessages(history);
    }
  });

  useSocketListener('newMessage', (msg) => {
    if (!msg) return;
    setMessages((prev) => {
      // Avoid duplicating messages we may have already seen via history.
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [...prev, msg];
    });
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!socket || !isConnected) return;
    const trimmedUsername = username.trim();
    const trimmedText = text.trim();
    if (!trimmedUsername || !trimmedText) return;
    socket.emit('sendMessage', { username: trimmedUsername, text: trimmedText });
    setText('');
  }

  const messageList = messages.map((msg) => (
    <li key={msg.id} className="message-item">
      <span className="message-username">{msg.username}</span>
      <span className="message-text">{msg.text}</span>
    </li>
  ));

  return (
    <div className="container">
      <main className="chat-main">
        <h1 className="chat-title">Real-Time Chat</h1>
        <p className="connection-status">
          Status:{' '}
          <span
            className={
              isConnected ? 'status-connected' : 'status-disconnected'
            }
          >
            {isConnected ? 'connected' : 'disconnected'}
          </span>{' '}
          {isConnected ? '🟢' : '🔴'}
        </p>

        <ul className="message-list" data-testid="message-list">
          {messageList}
        </ul>

        <form className="chat-form" onSubmit={handleSubmit}>
          <input
            className="chat-input"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            className="chat-input"
            type="text"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            className="chat-button"
            type="submit"
            disabled={!isConnected}
          >
            Send
          </button>
        </form>
      </main>
    </div>
  );
};
