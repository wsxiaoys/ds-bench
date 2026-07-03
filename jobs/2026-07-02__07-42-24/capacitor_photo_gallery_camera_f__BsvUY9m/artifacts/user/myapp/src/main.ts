import * as gallery from './gallery';
import { Filesystem, Directory } from '@capacitor/filesystem';

// Expose on window.gallery
(window as any).gallery = gallery;

async function renderGallery() {
  const listContainer = document.getElementById('gallery-list');
  if (!listContainer) return;
  listContainer.innerHTML = '';
  try {
    const photos = await gallery.listPhotos();
    for (const photoPath of photos) {
      const item = document.createElement('div');
      item.style.display = 'inline-block';
      item.style.margin = '10px';
      item.style.textAlign = 'center';

      const img = document.createElement('img');
      try {
        const fileData = await Filesystem.readFile({
          path: photoPath,
          directory: Directory.Data,
        });
        img.src = `data:image/jpeg;base64,${fileData.data}`;
      } catch (e) {
        console.error('Failed to read image file', e);
      }
      img.style.width = '150px';
      img.style.height = '150px';
      img.style.objectFit = 'cover';
      img.style.display = 'block';
      img.style.borderRadius = '8px';
      img.style.border = '1px solid #ccc';

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Delete';
      delBtn.style.marginTop = '5px';
      delBtn.addEventListener('click', async () => {
        await gallery.deletePhoto(photoPath);
        renderGallery();
      });

      item.appendChild(img);
      item.appendChild(delBtn);
      listContainer.appendChild(item);
    }
  } catch (err) {
    console.error('Error rendering gallery', err);
  }
}

function init() {
  const captureBtn = document.getElementById('capture-btn');
  const captureStatus = document.getElementById('capture-status');

  if (captureStatus) {
    captureStatus.textContent = 'idle';
  }

  if (captureBtn) {
    captureBtn.addEventListener('click', async () => {
      if (captureStatus) {
        captureStatus.textContent = 'capturing';
      }
      try {
        await gallery.capturePhoto();
        if (captureStatus) {
          captureStatus.textContent = 'saved';
        }
        renderGallery();
      } catch (error: any) {
        if (captureStatus) {
          captureStatus.textContent = `error: ${error.message || error}`;
        }
      }
    });
  }

  renderGallery();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
