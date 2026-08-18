import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { logout } from 'wasp/client/auth';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#f8f9fa' }}>
      <header style={{ backgroundColor: '#212529', color: 'white', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '20px' }}>
            <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Wasp Drive 📂</Link>
          </h1>
          <nav style={{ display: 'flex', gap: '15px' }}>
            <Link to="/" style={{ color: '#adb5bd', textDecoration: 'none' }}>Dashboard</Link>
            <Link to="/logs" style={{ color: '#adb5bd', textDecoration: 'none' }}>Access Logs</Link>
          </nav>
        </div>
        <button
          onClick={handleLogout}
          style={{ padding: '6px 12px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Logout
        </button>
      </header>
      <main style={{ flex: 1, padding: '20px', maxWidth: '1200px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {children}
      </main>
    </div>
  );
}
