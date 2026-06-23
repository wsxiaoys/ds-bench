import { LoginForm } from './LoginForm'
import './App.css'

function App() {
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>React Login Portal</h1>
        <p>TanStack Form & Zod Validation</p>
      </header>
      <main className="app-main">
        <LoginForm />
      </main>
      <footer className="app-footer">
        <p>&copy; 2026 Login Portal. All rights reserved.</p>
      </footer>
    </div>
  )
}

export default App
