import { LoginForm } from "wasp/client/auth";
import { Link } from "wasp/client/router";

export function LoginPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f7fafc' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '2rem', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', backgroundColor: '#ffffff' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#2d3748' }}>Login</h1>
        <LoginForm />
        <p style={{ marginTop: '1.5rem', textAlign: 'center', color: '#4a5568', fontSize: '0.9rem' }}>
          Don't have an account? <Link to="/signup" style={{ color: '#3182ce', textDecoration: 'none', fontWeight: 'bold' }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}
