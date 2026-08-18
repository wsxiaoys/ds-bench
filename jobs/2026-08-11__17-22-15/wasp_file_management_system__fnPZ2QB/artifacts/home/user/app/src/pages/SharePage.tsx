import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { useQuery, getShareLinkInfo } from 'wasp/client/operations';

export function SharePage() {
  const { linkId } = useParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);

  const { data: linkInfo, error: queryError, isLoading } = useQuery(getShareLinkInfo, { linkId: linkId || '' });

  useEffect(() => {
    if (queryError) {
      setError(queryError.message || 'Share link not found');
    } else if (linkInfo) {
      if (linkInfo.isExpired) {
        setError('This share link has expired');
      } else if (!linkInfo.isPasswordProtected) {
        setIsUnlocked(true);
      }
    }
  }, [linkInfo, queryError]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }
    setChecking(true);
    setError(null);

    try {
      // Call the download endpoint with verifyOnly=true to verify password
      const response = await fetch(`/api/download/${linkId}?password=${encodeURIComponent(password)}&verifyOnly=true`);
      if (response.ok) {
        setIsUnlocked(true);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Incorrect password');
      }
    } catch (err: any) {
      setError('Failed to verify password');
    } finally {
      setChecking(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center', marginTop: '100px' }}>
        <h2>Loading shared file...</h2>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', minHeight: '100vh', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', boxSizing: 'border-box' }}>
      <div style={{ backgroundColor: 'white', padding: '40px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', maxWidth: '500px', width: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>Wasp Drive Share</h1>
        <p style={{ color: '#6c757d', marginBottom: '30px' }}>You have been invited to access a shared file.</p>

        {error && (
          <div
            data-testid="share-error"
            style={{ padding: '12px', backgroundColor: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb', borderRadius: '4px', marginBottom: '20px', wordBreak: 'break-all' }}
          >
            {error}
          </div>
        )}

        {linkInfo && !linkInfo.isExpired && (
          <div>
            <div style={{ border: '1px solid #dee2e6', borderRadius: '6px', padding: '20px', marginBottom: '30px', backgroundColor: '#f8f9fa' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '10px' }}>📄</span>
              <strong style={{ display: 'block', fontSize: '18px', marginBottom: '5px', wordBreak: 'break-all' }}>{linkInfo.fileName}</strong>
              <span style={{ fontSize: '14px', color: '#6c757d' }}>Size: {(linkInfo.fileSize / 1024).toFixed(2)} KB</span>
            </div>

            {!isUnlocked && linkInfo.isPasswordProtected && (
              <form onSubmit={handleUnlock} style={{ textAlign: 'left' }}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>This file is password-protected:</label>
                  <input
                    type="password"
                    placeholder="Enter password to unlock"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="unlock-password-input"
                    style={{ width: '100%', padding: '10px', boxSizing: 'border-box', border: '1px solid #ced4da', borderRadius: '4px' }}
                    disabled={checking}
                  />
                </div>
                <button
                  type="submit"
                  data-testid="unlock-btn"
                  style={{ width: '100%', padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: '500' }}
                  disabled={checking}
                >
                  {checking ? 'Unlocking...' : 'Unlock File'}
                </button>
              </form>
            )}

            {isUnlocked && (
              <div>
                <p style={{ color: '#28a745', fontWeight: '500', marginBottom: '20px' }}>✓ File unlocked successfully</p>
                <a
                  href={`/api/download/${linkId}${password ? `?password=${encodeURIComponent(password)}` : ''}`}
                  data-testid="download-btn"
                  style={{
                    display: 'inline-block',
                    width: '100%',
                    padding: '12px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    textDecoration: 'none',
                    borderRadius: '4px',
                    fontSize: '16px',
                    fontWeight: '500',
                    boxSizing: 'border-box',
                  }}
                >
                  Download File
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
