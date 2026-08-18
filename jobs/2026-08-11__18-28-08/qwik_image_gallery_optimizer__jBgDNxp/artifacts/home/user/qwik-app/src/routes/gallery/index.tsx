import { component$ } from "@builder.io/qwik";
import { routeLoader$, useLocation } from "@builder.io/qwik-city";
import { getAllImages } from "../../utils/db";

export const useGalleryImages = routeLoader$(async () => {
  return await getAllImages();
});

export default component$(() => {
  const imagesSignal = useGalleryImages();
  const loc = useLocation();
  const error = loc.url.searchParams.get("error");

  return (
    <div class="gallery-container">
      <header class="header">
        <h1>Image Gallery</h1>
        <p>Upload, optimize, and view your images instantly.</p>
      </header>

      {error && (
        <div class="error-banner">
          <p>⚠️ Error: {decodeURIComponent(error)}</p>
        </div>
      )}

      <section class="upload-section">
        <h2>Upload New Image</h2>
        <form
          action="/gallery/upload"
          method="POST"
          enctype="multipart/form-data"
          class="upload-form"
        >
          <div class="file-input-wrapper">
            <input
              type="file"
              name="image"
              accept="image/*"
              required
              class="file-input"
            />
          </div>
          <button type="submit" class="submit-btn">
            Upload & Optimize
          </button>
        </form>
      </section>

      <section class="gallery-section">
        <h2>Optimized Images</h2>
        {imagesSignal.value.length === 0 ? (
          <p class="empty-message">No images uploaded yet. Upload one above!</p>
        ) : (
          <div class="image-grid">
            {imagesSignal.value.map((img) => (
              <div key={img.id} class="image-card">
                <div class="image-wrapper">
                  <img
                    src={img.optimized_path}
                    alt={img.original_name}
                    class="gallery-image"
                    loading="lazy"
                    width={img.width}
                    height={img.height}
                  />
                </div>
                <div class="image-info">
                  <p class="filename" title={img.original_name}>
                    {img.original_name}
                  </p>
                  <p class="dimensions">
                    {img.width}x{img.height}
                  </p>
                  <a
                    href={img.original_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="view-link"
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
