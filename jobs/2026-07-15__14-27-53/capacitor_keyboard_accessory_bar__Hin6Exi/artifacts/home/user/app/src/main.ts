// Entry point for the composer web app.

const composer = document.getElementById('composer');

if (!composer) {
  console.warn('Composer element not found.');
}

// Keep the composer bar above the on-screen keyboard by tracking the reported
// keyboard height through a CSS custom property. The webview shim used in the
// browser dispatches cordova-plugin-ionic-keyboard style window events that
// carry the keyboard height directly on the event object, so we read it from
// `event.keyboardHeight` instead of relying on any native plugin APIs.
const root = document.documentElement;

function handleKeyboardShow(event: Event) {
  const keyboardHeight = (event as CustomEvent<{ keyboardHeight: number }>).detail
    ?? (event as unknown as { keyboardHeight?: number }).keyboardHeight;

  if (typeof keyboardHeight !== 'number') {
    return;
  }

  root.style.setProperty('--keyboard-offset', `${keyboardHeight}px`);
  document.body.classList.add('keyboard-open');
}

function handleKeyboardHide() {
  root.style.setProperty('--keyboard-offset', '0px');
  document.body.classList.remove('keyboard-open');
}

window.addEventListener('keyboardWillShow', handleKeyboardShow);
window.addEventListener('keyboardDidShow', handleKeyboardShow);
window.addEventListener('keyboardWillHide', handleKeyboardHide);
window.addEventListener('keyboardDidHide', handleKeyboardHide);
