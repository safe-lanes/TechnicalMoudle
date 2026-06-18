/**
 * Returns true when the app is running inside the Replit workspace.
 *
 * Vite only exposes `VITE_`-prefixed vars to the browser, so we read
 * `VITE_APP_ENV` (set to `replit` in the Replit workspace only). In every other
 * environment (production / local) it is unset, so this returns false.
 */
export function isReplit(): boolean {
  return import.meta.env.VITE_APP_ENV === "replit";
}
