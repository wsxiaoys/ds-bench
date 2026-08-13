import { component$ } from '@builder.io/qwik';
import { routeLoader$ } from '@builder.io/qwik-city';
import db, { type ImageRecord } from '../../lib/db';

export const useImagesLoader = routeLoader$(async () => {
  try {
    const stmt = db.prepare(`
      SELECT id, original_name, original_path, optimized_path, width, height, uploaded_at
      FROM images
      ORDER BY uploaded_at DESC
    `);
    return stmt.all() as ImageRecord[];
  } catch (err) {
    console.error('Error loading images:', err);
    return [];
  }
});

export default component$(() => {
  const imagesSignal = useImagesLoader();

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <header style={{ marginBottom: '40px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
        <h1 style={{ margin: '0 0 10px 0', color: '#111' }}>Image Gallery</h1>
        <p style={{ margin: 0, color: '#666' }}>Upload and optimize your images locally.</p>
      </header>

      <section style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px', marginBottom: '40px', border: '1px solid #eee' }}>
        <h2 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.2rem', color: '#333' }}>Upload New Image</h2>
        <form action="/gallery/upload" method="POST" encType="multipart/form-data" style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input 
            type="file" 
            name="image" 
            accept="image/*" 
            required
            style={{
              padding: '8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#fff',
              cursor: 'pointer'
            }}
          />
          <button 
            type="submit" 
            style={{
              padding: '10px 20px',
              backgroundColor: '#0070f3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            Upload & Optimize
          </button>
        </form>
      </section>

      <section>
        <h2 style={{ marginBottom: '20px', fontSize: '1.5rem', color: '#333' }}>Gallery ({imagesSignal.value.length})</h2>
        {imagesSignal.value.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic' }}>No images uploaded yet. Use the form above to add some!</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '25px'
          }}>
            {imagesSignal.value.map((image) => (
              <div 
                key={image.id} 
                style={{
                  border: '1px solid #eee',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  backgroundColor: '#fff',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ position: 'relative', paddingBottom: '75%', backgroundColor: '#f0f0f0', overflow: 'hidden' }}>
                  <img 
                    src={image.optimized_path} 
                    alt={image.original_name}
                    loading="lazy"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                  />
                </div>
                <div style={{ padding: '15px', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ marginBottom: '15px' }}>
                    <p style={{ 
                      margin: '0 0 5px 0', 
                      fontWeight: 'bold', 
                      fontSize: '0.95rem',
                      color: '#222',
                      wordBreak: 'break-all',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical'
                    }} title={image.original_name}>
                      {image.original_name}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                      Optimized size: <strong>{image.width} x {image.height}</strong>
                    </p>
                  </div>
                  <a 
                    href={image.original_path} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-block',
                      textAlign: 'center',
                      padding: '8px 12px',
                      backgroundColor: '#f0f0f0',
                      color: '#0070f3',
                      textDecoration: 'none',
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      transition: 'background-color 0.2s, color 0.2s'
                    }}
                  >
                    View Original
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
});
