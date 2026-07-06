import { Preferences } from "@capacitor/preferences";

/**
 * Re-renders #kv-list from the current state of the Preferences store.
 *
 * Calls Preferences.keys() to enumerate the stored keys, then calls
 * Preferences.get({ key }) for each one, and finally appends a fresh
 * <li data-key="<key>"><key>=<value></li> for every pair.
 *
 * Any existing <li> children are cleared first so the list always
 * reflects the current Preferences state.
 */
async function refreshList(): Promise<void> {
  const list = document.getElementById("kv-list");
  if (!list) {
    return;
  }

  // Clear existing <li> children before re-rendering.
  list.replaceChildren();

  const { keys } = await Preferences.keys();

  // Deduplicate in case the underlying store ever returns duplicates.
  const uniqueKeys = Array.from(new Set(keys));

  // Preserve first-seen ordering so successive calls don't reshuffle the list.
  const seen = new Set<string>();
  for (const key of uniqueKeys) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const { value } = await Preferences.get({ key });
    const li = document.createElement("li");
    li.dataset.key = key;
    li.textContent = `${key}=${value ?? ""}`;
    list.appendChild(li);
  }
}

async function handleSet(): Promise<void> {
  const keyInput = document.getElementById("kv-key") as HTMLInputElement | null;
  const valueInput = document.getElementById("kv-value") as HTMLInputElement | null;
  if (!keyInput || !valueInput) {
    return;
  }

  const key = keyInput.value;
  const value = valueInput.value;

  if (key.length === 0) {
    return;
  }

  await Preferences.set({ key, value });
  await refreshList();
}

async function handleRemove(): Promise<void> {
  const keyInput = document.getElementById("kv-key") as HTMLInputElement | null;
  if (!keyInput) {
    return;
  }

  const key = keyInput.value;
  if (key.length === 0) {
    return;
  }

  await Preferences.remove({ key });
  await refreshList();
}

async function handleClear(): Promise<void> {
  await Preferences.clear();
  await refreshList();
}

function wireUp(): void {
  const setBtn = document.getElementById("kv-set-btn");
  const removeBtn = document.getElementById("kv-remove-btn");
  const clearBtn = document.getElementById("kv-clear-btn");

  setBtn?.addEventListener("click", () => {
    void handleSet();
  });
  removeBtn?.addEventListener("click", () => {
    void handleRemove();
  });
  clearBtn?.addEventListener("click", () => {
    void handleClear();
  });
}

wireUp();
void refreshList();