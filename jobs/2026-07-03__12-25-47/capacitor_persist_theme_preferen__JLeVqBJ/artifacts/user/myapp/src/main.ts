import { Preferences } from '@capacitor/preferences';

const PREFERENCES_KEY = 'user_theme';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

async function loadSavedTheme(): Promise<Theme> {
  try {
    const { value } = await Preferences.get({ key: PREFERENCES_KEY });
    if (value === 'dark' || value === 'light') {
      return value;
    }
  } catch (err) {
    console.warn('Failed to read theme from Preferences:', err);
  }
  return 'light';
}

async function saveTheme(theme: Theme): Promise<void> {
  try {
    await Preferences.set({ key: PREFERENCES_KEY, value: theme });
  } catch (err) {
    console.warn('Failed to save theme to Preferences:', err);
  }
}

async function init(): Promise<void> {
  const initialTheme = await loadSavedTheme();
  applyTheme(initialTheme);

  const button = document.getElementById('theme-toggle');
  if (button) {
    button.addEventListener('click', async () => {
      const current = document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light';
      const next: Theme = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      await saveTheme(next);
    });
  }
}

void init();
