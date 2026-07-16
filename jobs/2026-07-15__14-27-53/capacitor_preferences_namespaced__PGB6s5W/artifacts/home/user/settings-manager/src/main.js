import { settings } from './settings.js';

// Expose the namespaced settings manager on the page as `window.settings`.
// Every method returns a Promise so callers can `await` it.
window.settings = settings;