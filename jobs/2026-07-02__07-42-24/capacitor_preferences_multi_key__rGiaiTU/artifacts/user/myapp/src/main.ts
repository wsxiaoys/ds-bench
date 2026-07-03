import { Preferences } from '@capacitor/preferences';

const keyInput = document.getElementById('kv-key') as HTMLInputElement;
const valueInput = document.getElementById('kv-value') as HTMLInputElement;
const setBtn = document.getElementById('kv-set-btn') as HTMLButtonElement;
const removeBtn = document.getElementById('kv-remove-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('kv-clear-btn') as HTMLButtonElement;
const kvList = document.getElementById('kv-list') as HTMLUListElement;

async function refreshList() {
  if (!kvList) return;

  // Clear existing items
  kvList.innerHTML = '';

  // Get keys
  const { keys } = await Preferences.keys();

  // For each key, get value and render
  for (const key of keys) {
    const { value } = await Preferences.get({ key });
    
    // Create li element
    const li = document.createElement('li');
    li.setAttribute('data-key', key);
    li.textContent = `${key}=${value ?? ''}`;
    kvList.appendChild(li);
  }
}

setBtn?.addEventListener('click', async () => {
  const key = keyInput?.value || '';
  const value = valueInput?.value || '';
  if (!key) {
    return;
  }
  await Preferences.set({ key, value });
  
  if (keyInput) keyInput.value = '';
  if (valueInput) valueInput.value = '';
  
  await refreshList();
});

removeBtn?.addEventListener('click', async () => {
  const key = keyInput?.value || '';
  if (!key) {
    return;
  }
  await Preferences.remove({ key });
  
  if (keyInput) keyInput.value = '';
  
  await refreshList();
});

clearBtn?.addEventListener('click', async () => {
  await Preferences.clear();
  
  if (keyInput) keyInput.value = '';
  if (valueInput) valueInput.value = '';
  
  await refreshList();
});

// Initial load on page load
refreshList();
