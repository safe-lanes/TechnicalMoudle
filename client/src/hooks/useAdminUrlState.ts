import { useCallback, useEffect, useSyncExternalStore, type SetStateAction } from "react";

const CHANGE_EVENT = "pms-admin-state-change";
const PREFIX = "pms.";

export function readAdminValue<T extends string | number | boolean>(
  search: string,
  key: string,
  fallback: T,
  choices?: readonly string[],
): T {
  const raw = new URLSearchParams(search).get(PREFIX + key);
  if (raw === null || raw.length > 1000) return fallback;
  if (typeof fallback === "boolean") return (raw === "true" ? true : raw === "false" ? false : fallback) as T;
  if (typeof fallback === "number") {
    const value = Number(raw);
    return (raw !== "" && Number.isSafeInteger(value) && value >= 0 ? value : fallback) as T;
  }
  return (choices && !choices.includes(raw) ? fallback : raw) as T;
}

export function updateAdminUrl(url: string, key: string, value: string | number | boolean, fallback: string | number | boolean) {
  const next = new URL(url);
  // Empty/default values are removed, so clearing a filter survives refresh.
  if (value === fallback) next.searchParams.delete(PREFIX + key);
  else next.searchParams.set(PREFIX + key, String(value));
  return next;
}

function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}

/** Only call for browsing preferences, never files, forms, dialogs or action selections. */
export function useAdminUrlState<T extends string | number | boolean>(
  key: string,
  fallback: T,
  choices?: readonly string[],
  navigation = false,
): [T, (value: SetStateAction<T>) => void] {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => "");
  const value = readAdminValue(search, key, fallback, choices);
  const setValue = useCallback((update: SetStateAction<T>) => {
    // Read at invocation, not from a stale render: consecutive updates preserve each other.
    const current = readAdminValue(window.location.search, key, fallback, choices);
    const nextValue = typeof update === "function" ? update(current) : update;
    const next = updateAdminUrl(window.location.href, key, nextValue, fallback);
    if (next.href === window.location.href) return;
    window.history[navigation ? "pushState" : "replaceState"](window.history.state, "", next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [key, fallback, choices, navigation]);
  return [value, setValue];
}

/** Do not reject a restored selection until its options have actually loaded. */
export function useAdminOptionValidation(
  value: string, setValue: (value: string) => void,
  options: readonly string[] | undefined, fallback = "",
) {
  useEffect(() => {
    if (options && value !== fallback && !options.includes(value)) setValue(fallback);
  }, [value, setValue, options, fallback]);
}
