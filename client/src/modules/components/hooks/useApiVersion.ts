import { useCallback, useSyncExternalStore } from "react";
import { queryClient } from "@/lib/queryClient";
import { getApiMode, setApiMode, type ApiMode } from "../api/componentApiV2";

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): ApiMode {
  return getApiMode();
}

export function setApiModeAndNotify(newMode: ApiMode) {
  setApiMode(newMode);
  listeners.forEach((l) => l());
}

export function useApiVersion() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const toggleMode = useCallback(() => {
    const newMode: ApiMode = mode === 'legacy' ? 'v2' : 'legacy';
    setApiModeAndNotify(newMode);

    queryClient.invalidateQueries({ predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      return key.startsWith('/technical/api/component') || 
             key.startsWith('/technical/api/v2/components') ||
             key.startsWith('/technical/api/bulk') ||
             key.startsWith('/technical/api/v2/bulk');
    }});
  }, [mode]);

  return { mode, toggleMode, isV2: mode === 'v2' };
}
