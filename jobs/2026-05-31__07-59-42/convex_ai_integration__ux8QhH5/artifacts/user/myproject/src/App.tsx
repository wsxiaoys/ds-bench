import { useState } from 'react'
import { useQuery, useAction } from 'convex/react'
import { api } from '../convex/_generated/api'

function App() {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const generations = useQuery(api.ai.list)
  const generate = useAction(api.ai.generate)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim() || isGenerating) return
    setIsGenerating(true)
    try {
      await generate({ prompt: prompt.trim() })
      setPrompt('')
    } catch (error) {
      console.error('Generation failed:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>AI Generation App</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a prompt..."
            disabled={isGenerating}
            style={{ flex: 1, padding: '0.5rem', fontSize: '1rem' }}
          />
          <button
            type="submit"
            disabled={isGenerating || !prompt.trim()}
            style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}
          >
            {isGenerating ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </form>

      <h2>Generations</h2>
      {generations === undefined ? (
        <p>Loading...</p>
      ) : generations.length === 0 ? (
        <p>No generations yet. Submit a prompt above!</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {generations.map((gen) => (
            <li key={gen._id} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
              <strong>Prompt:</strong> {gen.prompt}
              <br />
              <strong>Result:</strong> {gen.result}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default App