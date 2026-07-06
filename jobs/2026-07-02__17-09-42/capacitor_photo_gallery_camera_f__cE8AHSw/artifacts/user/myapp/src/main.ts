// Entry point that wires the Capacitor-based photo gallery UI and
// exposes the gallery module on `window.gallery` for REDACTEDmated tests.

import './gallery';

function updateStatus(text: string): void {
  const status = document.getElementById('capture-status');
  if (status) {
    status.textContent = text;
  }
}

async function onCaptureClick(): Promise<void> {
  if (!window.gallery) {
    updateStatus('error: gallery module not loaded');
    return;
  }
  updateStatus('capturing');
  try {
    const path = await window.gallery.capturePhoto();
    updateStatus(`saved: ${path}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateStatus(`error: ${message}`);
  }
}

function init(): void {
  // Initial status - tests rely on the literal text "idle" before
  // any capture attempt has been made.
  const status = document.getElementById('capture-status');
  if (status) {
    status.textContent = 'idle';
  }

  const btn = document.getElementById('capture-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      void onCaptureClick();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
