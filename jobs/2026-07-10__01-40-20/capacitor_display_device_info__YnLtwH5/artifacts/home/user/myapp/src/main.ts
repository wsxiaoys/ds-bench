import { Device } from "@capacitor/device";

async function renderDeviceInfo(): Promise<void> {
  const info = await Device.getInfo();

  const platformEl = document.getElementById("device-platform");
  const osEl = document.getElementById("device-os");

  if (platformEl) {
    platformEl.textContent = info.platform;
  }

  if (osEl) {
    osEl.textContent = info.operatingSystem;
  }
}

renderDeviceInfo().catch((err) => {
  console.error("Failed to load device info:", err);
});