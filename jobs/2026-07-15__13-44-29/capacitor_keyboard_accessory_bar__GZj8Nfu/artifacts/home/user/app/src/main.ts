import { Keyboard } from '@capacitor/keyboard';

// Entry point for the composer web app.

const composer = document.getElementById('composer');

if (!composer) {
  console.warn('Composer element not found.');
}

// Function to handle keyboard show
function handleKeyboardShow(height: number) {
  document.documentElement.style.setProperty('--keyboard-offset', `${height}px`);
  document.body.classList.add('keyboard-open');
}

// Function to handle keyboard hide
function handleKeyboardHide() {
  document.documentElement.style.setProperty('--keyboard-offset', '0px');
  document.body.classList.remove('keyboard-open');
}

// 1. Capacitor native keyboard listeners
Keyboard.addListener('keyboardWillShow', (info) => {
  handleKeyboardShow(info.keyboardHeight);
});

Keyboard.addListener('keyboardWillHide', () => {
  handleKeyboardHide();
});

// 2. Plain browser/web context window event listeners
window.addEventListener('keyboardWillShow', (e: any) => {
  if (e && typeof e.keyboardHeight === 'number') {
    handleKeyboardShow(e.keyboardHeight);
  }
});

window.addEventListener('keyboardWillHide', () => {
  handleKeyboardHide();
});
