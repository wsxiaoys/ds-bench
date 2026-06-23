import UserTable from './UserTable'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>User Management</h1>
        <p className="subtitle">
          Click <strong>Edit</strong> on any row to update user details inline.
        </p>
      </header>
      <main className="app-main">
        <UserTable />
      </main>
    </div>
  )
}

export default App
