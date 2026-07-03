import { Device } from "@capacitor/device";

interface DeviceInfoView {
  platformEl: HTMLElement | null;
  osEl: HTMLElement | null;
}

async function renderDeviceInfo(): Promise<void> {
  const view: DeviceInfoView = {
    platformEl: document.getElementById("device-platform"),
    osEl: document.getElementById("device-os"),
  };

  try {
    const info = await Device.getInfo();
    if (view.platformEl) {
      view.platformEl.textContent = info.platform;
    }
    if (view.osEl) {
      view.osEl.textContent = info.operatingSystem;
    }
  } catch (error) {
    if (view.platformEl) {
      view.platformEl.textContent = "unavailable";
    }
    if (view.osEl) {
      view.osEl.textContent = "unavailable";
    }
    console.error("Failed to read device info", error);
  }
}

renderDeviceInfo();