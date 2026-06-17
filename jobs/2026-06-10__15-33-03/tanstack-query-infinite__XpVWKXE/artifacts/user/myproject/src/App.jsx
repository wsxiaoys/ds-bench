import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Feed from './Feed';
import './App.css';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Feed />
    </QueryClientProvider>
  );
}

export default App;