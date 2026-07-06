import DataGrid from './DataGrid'
import './App.css'

function App() {
  return (
    <div className="app">
      <h1>Basic Data Grid</h1>
      <p>Powered by TanStack Table</p>
      <div className="grid-wrapper">
        <DataGrid />
      </div>
    </div>
  )
}

export default App