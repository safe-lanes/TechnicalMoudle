import { useState, useCallback } from "react";
import { queryClient } from "@/lib/queryClient";
import { getApiMode, setApiMode, type ApiMode } from "../api/componentApiV2";

export function useApiVersion() {
  const [mode, setMode] = useState<ApiMode>(getApiMode);

  const toggleMode = useCallback(() => {
    const newMode: ApiMode = mode === 'legacy' ? 'v2' : 'legacy';
    setApiMode(newMode);
    setMode(newMode);

    queryClient.invalidateQueries({ predicate: (query) => {
      const key = query.queryKey[0];
      if (typeof key !== 'string') return false;
      return key.startsWith('/technical/api/component') || 
             key.startsWith('/technical/api/v2/components');
    }});
  }, [mode]);

  return { mode, toggleMode, isV2: mode === 'v2' };
}
