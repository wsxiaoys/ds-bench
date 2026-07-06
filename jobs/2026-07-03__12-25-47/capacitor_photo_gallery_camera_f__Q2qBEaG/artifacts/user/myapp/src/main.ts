import { capturePhoto, listPhotos, deletePhoto } from './gallery';

// Expose the gallery API on window for REDACTEDmated tests
declare global {
  interface Window {
    gallery: {
      capturePhoto: typeof capturePhoto;
      listPhotos: typeof listPhotos;
      deletePhoto: typeof deletePhoto;
    };
  }
}

window.gallery = {
  capturePhoto,
  listPhotos,
  deletePhoto,
};

const statusEl = document.getElementById('capture-status');
if (statusEl) {
  statusEl.textContent = 'idle';
}

const captureBtn = document.getElementById('capture-btn');
if (captureBtn) {
  captureBtn.addEventListener('click', async () => {
    if (statusEl) {
      statusEl.textContent = 'capturing';
    }
    try {
      const path = await capturePhoto();
      if (statusEl) {
        statusEl.textContent = 'saved';
      }
      console.log('Saved photo at', path);
    } catch (err: any) {
      if (statusEl) {
        statusEl.textContent = `error: ${err?.message ?? String(err)}`;
      }
      console.error('Capture failed:', err);
    }
  });
}
