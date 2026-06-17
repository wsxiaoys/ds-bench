import { useState } from 'react';
import { useQuery, useAction } from 'convex/react';
import { api } from '../convex/_generated/api';

function App() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  
  const generations = useQuery(api.ai.list);
  const generateAction = useAction(api.ai.generate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    setLoading(true);
    try {
      await generateAction({ prompt });
      setPrompt('');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>AI Generations</h1>
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <input 
          type="text" 
          value={prompt} 
          onChange={(e) => setPrompt(e.target.value)} 
          placeholder="Enter a prompt"
          disabled={loading}
          style={{ padding: '0.5rem', marginRight: '0.5rem', width: '300px' }}
        />
        <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem' }}>
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </form>
      
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {generations?.map((gen, i) => (
          <li key={i} style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}>
            <strong>Prompt:</strong> {gen.prompt} <br/>
            <br/>
            <strong>Result:</strong> {gen.result}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
