import { Preferences } from "@capacitor/preferences";

type Theme = "light" | "dark";

const THEME_KEY = "user_theme";
const DEFAULT_THEME: Theme = "light";

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  const indicator = document.getElementById("current-theme");
  if (indicator) {
    indicator.textContent = `Current theme: ${theme}`;
  }
}

async function loadTheme(): Promise<Theme> {
  try {
    const { value } = await Preferences.get({ key: THEME_KEY });
    return isTheme(value) ? value : DEFAULT_THEME;
  } catch (err) {
    // Preferences may throw in unusual environments; fall back to the default.
    console.warn("Failed to read theme preference, using default.", err);
    return DEFAULT_THEME;
  }
}

async function saveTheme(theme: Theme): Promise<void> {
  try {
    await Preferences.set({ key: THEME_KEY, value: theme });
  } catch (err) {
    console.warn("Failed to persist theme preference.", err);
  }
}

async function toggleTheme(current: Theme): Promise<Theme> {
  const next: Theme = current === "dark" ? "light" : "dark";
  applyTheme(next);
  await saveTheme(next);
  return next;
}

async function bootstrap(): Promise<void> {
  const initialTheme = await loadTheme();

  // Apply persisted theme before the user interacts to avoid a flash of
  // incorrect styling on reload.
  applyTheme(initialTheme);

  const button = document.getElementById("theme-toggle");
  if (!button) {
    return;
  }

  let activeTheme = initialTheme;
  button.addEventListener("click", async () => {
    activeTheme = await toggleTheme(activeTheme);
  });
}

bootstrap();