import { Preferences } from "@capacitor/preferences";

const THEME_KEY = "user_theme";
type Theme = "light" | "dark";

const toggleButton = document.getElementById("theme-toggle") as HTMLButtonElement | null;
const themeNameSpan = document.getElementById("theme-name") as HTMLSpanElement | null;

function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  if (themeNameSpan) {
    themeNameSpan.textContent = theme;
  }
  if (toggleButton) {
    toggleButton.textContent = theme === "dark" ? "Switch to Light" : "Switch to Dark";
  }
}

async function readStoredTheme(): Promise<Theme> {
  const { value } = await Preferences.get({ key: THEME_KEY });
  return value === "dark" ? "dark" : "light";
}

async function persistTheme(theme: Theme): Promise<void> {
  await Preferences.set({ key: THEME_KEY, value: theme });
}

async function toggleTheme(): Promise<void> {
  const current = document.documentElement.getAttribute("data-theme") as Theme | null;
  const next: Theme = current === "dark" ? "light" : "dark";
  applyTheme(next);
  await persistTheme(next);
}

async function init(): Promise<void> {
  // Apply the default theme immediately so the UI never flashes the wrong state.
  applyTheme("light");

  const stored = await readStoredTheme();
  applyTheme(stored);

  if (toggleButton) {
    toggleButton.addEventListener("click", () => {
      void toggleTheme();
    });
  }
}

void init();