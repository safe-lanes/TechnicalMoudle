import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { formatWorkOrderToast } from "@/lib/workOrderErrorFeedback";

/** Scoped to Work Order screens; the shared toast and request helpers are unchanged. */
export function useWorkOrderToast(defaultFailureTitle = "Work Order Save Failed") {
  const state = useToast();
  type Toast = Parameters<typeof state.toast>[0];
  const toast = useCallback((props: Omit<Toast, "description"> & { description?: unknown }) => {
    const formatted = formatWorkOrderToast(props, defaultFailureTitle);
    return state.toast({ ...formatted, description: formatted.description as Toast["description"] });
  }, [state.toast, defaultFailureTitle]);
  return { ...state, toast };
}
