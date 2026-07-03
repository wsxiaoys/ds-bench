import { Preferences } from "@capacitor/preferences";

// Key/value admin UI backed by @capacitor/preferences.
// All persistence goes through the Preferences plugin (no direct window.localStorage use).

const keyInput = document.getElementById("kv-key") as HTMLInputElement | null;
const valueInput = document.getElementById("kv-value") as HTMLInputElement | null;
const setBtn = document.getElementById("kv-set-btn") as HTMLButtonElement | null;
const removeBtn = document.getElementById("kv-remove-btn") as HTMLButtonElement | null;
const clearBtn = document.getElementById("kv-clear-btn") as HTMLButtonElement | null;
const listEl = document.getElementById("kv-list") as HTMLUListElement | null;

/**
 * Re-render the #kv-list from scratch using the current Preferences state.
 *
 * 1. Enumerate keys via Preferences.keys()
 * 2. Fetch each value via Preferences.get({ key })
 * 3. Render `<li data-key="<key>"><key>=<value></li>` for each pair
 */
async function refreshList(): Promise<void> {
  if (!listEl) {
    return;
  }

  // Clear existing children so the list always reflects current state.
  listEl.textContent = "";

  const { keys } = await Preferences.keys();

  for (const key of keys) {
    const { value } = await Preferences.get({ key });
    const li = document.createElement("li");
    li.setAttribute("data-key", key);
    li.textContent = `${key}=${value ?? ""}`;
    listEl.appendChild(li);
  }
}

async function setPair(): Promise<void> {
  if (!keyInput || !valueInput) {
    return;
  }
  const key = keyInput.value.trim();
  const value = valueInput.value;
  if (!key) {
    return;
  }
  await Preferences.set({ key, value });
  await refreshList();
}

async function removePair(): Promise<void> {
  if (!keyInput) {
    return;
  }
  const key = keyInput.value.trim();
  if (!key) {
    return;
  }
  await Preferences.remove({ key });
  await refreshList();
}

async function clearAll(): Promise<void> {
  await Preferences.clear();
  await refreshList();
}

function wireEvents(): void {
  setBtn?.addEventListener("click", () => {
    void setPair();
  });
  removeBtn?.addEventListener("click", () => {
    void removePair();
  });
  clearBtn?.addEventListener("click", () => {
    void clearAll();
  });
}

wireEvents();

// Refresh on every page load.
void refreshList();