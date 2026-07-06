import { capturePhoto, listPhotos, deletePhoto } from "./gallery";

interface GalleryApi {
  capturePhoto: typeof capturePhoto;
  listPhotos: typeof listPhotos;
  deletePhoto: typeof deletePhoto;
}

declare global {
  interface Window {
    gallery: GalleryApi;
  }
}

// Expose the gallery module on window so REDACTEDmated tests can drive it.
window.gallery = {
  capturePhoto,
  listPhotos,
  deletePhoto,
};

function setStatusBar(text: string): void {
  const status = document.getElementById("capture-status");
  if (status) {
    status.textContent = text;
  }
}

function wireCaptureButton(): void {
  const btn = document.getElementById("capture-btn");
  if (!btn) {
    return;
  }

  btn.addEventListener("click", async () => {
    setStatusBar("capturing");
    try {
      await window.gallery.capturePhoto();
      setStatusBar("saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusBar(`error: ${message}`);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Ensure the status element starts in the idle state on initial load.
  setStatusBar("idle");
  wireCaptureButton();
});

// If the DOM is already loaded (e.g. script executed after parse), set up now.
if (document.readyState === "interactive" || document.readyState === "complete") {
  setStatusBar("idle");
  wireCaptureButton();
}