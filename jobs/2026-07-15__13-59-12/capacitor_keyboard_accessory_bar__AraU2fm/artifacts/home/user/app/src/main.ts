// Entry point for the composer web app.
//
// The @capacitor/keyboard plugin is configured in capacitor.config.ts to resize
// the `body` element, force a dark keyboard appearance, and enable the Android
// full-screen resize workaround.
//
// In a native Capacitor context the plugin emits show/hide events through the
// `Keyboard` proxy. In a plain web/browser context those same events are also
// delivered as `window` events (`keyboardWillShow`, `keyboardDidShow`,
// `keyboardWillHide`, `keyboardDidHide`) via the cordova-plugin-ionic-keyboard
// compatibility layer. We listen on `window` so the same code path works in both
// environments.
//
// When the keyboard appears we lift the sticky composer bar above it by
// setting the `--keyboard-offset` CSS custom property on the document root to
// the reported keyboard height. The existing stylesheet consumes that variable
// to move `#composer`. When the keyboard hides we reset the offset and remove
// the `keyboard-open` marker class.

const composer = document.getElementById('composer');

if (!composer) {
  console.warn('Composer element not found.');
}

/**
 * Apply (or clear) the keyboard offset on the document root element.
 *
 * @param height Keyboard height in CSS pixels, or `0` when hiding.
 */
function setKeyboardOffset(height: number): void {
  document.documentElement.style.setProperty(
    '--keyboard-offset',
    `${height}px`,
  );
}

/**
 * Show handler: lift the composer above the keyboard.
 */
function handleKeyboardShow(event: Event): void {
  // The compatibility layer exposes the keyboard height as a direct numeric
  // property on the event object (`keyboardHeight`). Read it dynamically so we
  // always use the real reported height instead of a hardcoded value.
  const keyboardHeight = (event as KeyboardShowEvent).keyboardHeight;

  if (typeof keyboardHeight === 'number' && keyboardHeight > 0) {
    setKeyboardOffset(keyboardHeight);
  } else {
    // Fall back to 0 if no usable height was reported.
    setKeyboardOffset(0);
  }

  document.body.classList.add('keyboard-open');
}

/**
 * Hide handler: drop the composer back to the bottom of the viewport.
 */
function handleKeyboardHide(): void {
  setKeyboardOffset(0);
  document.body.classList.remove('keyboard-open');
}

// Describe the shape of the keyboard show events delivered via `window`.
interface KeyboardShowEvent extends Event {
  keyboardHeight?: number;
}

// Register handlers for the keyboard lifecycle events. We listen to at least
// the `keyboardWillShow` and `keyboardWillHide` events (as required), and also
// the `did` variants so the composer stays correctly positioned regardless of
// which event the host environment dispatches.
window.addEventListener('keyboardWillShow', handleKeyboardShow);
window.addEventListener('keyboardDidShow', handleKeyboardShow);
window.addEventListener('keyboardWillHide', handleKeyboardHide);
window.addEventListener('keyboardDidHide', handleKeyboardHide);