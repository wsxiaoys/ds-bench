/**
 * Plain constants with zero Node-only dependencies, safe to import from
 * client-rendered component code (unlike `./storage`, which touches the
 * filesystem and a native SQLite binding and must only ever be reached from
 * server-only code paths like `routeAction$` / `routeLoader$` / `onGet`).
 */

/** Maximum accepted upload size, in bytes (1 MiB). */
export const MAX_UPLOAD_BYTES = 1_048_576;
