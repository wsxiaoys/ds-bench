import { Preferences } from '@capacitor/preferences';

async function initTheme() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeText = document.getElementById('current-theme-text');

  // Load persisted theme
  const { value } = await Preferences.get({ key: 'user_theme' });
  let currentTheme: 'light' | 'dark' = 'light';

  if (value === 'dark') {
    currentTheme = 'dark';
    document.documentElement.classList.add('dark');
  } else {
    currentTheme = 'light';
    document.documentElement.classList.remove('dark');
  }

  if (themeText) {
    themeText.textContent = currentTheme;
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', async () => {
      if (currentTheme === 'light') {
        currentTheme = 'dark';
        document.documentElement.classList.add('dark');
      } else {
        currentTheme = 'light';
        document.documentElement.classList.remove('dark');
      }

      if (themeText) {
        themeText.textContent = currentTheme;
      }

      await Preferences.set({
        key: 'user_theme',
        value: currentTheme,
      });
    });
  }
}

// Run the initialization
initTheme();
