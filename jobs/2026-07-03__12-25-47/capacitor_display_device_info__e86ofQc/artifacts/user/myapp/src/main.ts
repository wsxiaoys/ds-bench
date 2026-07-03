import { Device } from '@capacitor/device';

async function displayDeviceInfo() {
  const platformEl = document.getElementById('device-platform');
  const osEl = document.getElementById('device-os');

  try {
    const info = await Device.getInfo();
    if (platformEl) {
      platformEl.textContent = info.platform;
    }
    if (osEl) {
      osEl.textContent = info.operatingSystem;
    }
  } catch (err) {
    if (platformEl) {
      platformEl.textContent = 'unknown';
    }
    if (osEl) {
      osEl.textContent = 'unknown';
    }
    console.error('Failed to get device info', err);
  }
}

displayDeviceInfo();
