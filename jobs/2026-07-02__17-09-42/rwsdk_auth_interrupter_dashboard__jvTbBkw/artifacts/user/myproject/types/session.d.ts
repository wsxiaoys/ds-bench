/**
 * Build-time constant injected by `vite.config.mts`. The value is the
 * trimmed contents of `/home/user/session_secret.txt`, used as the HMAC
 * key for signing session cookies.
 */
declare const __SESSION_SECRET__: string;