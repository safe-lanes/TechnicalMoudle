import React from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatWorkOrderDateDDMMYYYY, normalizeWorkOrderDateTyping, workOrderDateInputValue } from "@shared/dateUtils";
import { plannerDateCommitValue, plannerDateDraftValue } from "@/lib/plannerDatePresentation";

interface PlannerDateInputProps {
  value: string | null | undefined;
  onChange: (value: string) => void | Promise<unknown>;
  disabled?: boolean;
  className?: string;
  containerClassName?: string;
  /** Bulk state has no autosave: invalidate incomplete drafts immediately. */
  commitOnChange?: boolean;
  "data-testid": string;
  "aria-label": string;
}

/** Planner-only commit semantics; shared form inputs retain their existing behavior. */
export function PlannerDateInput({
  value, onChange, disabled = false, className = "", containerClassName = "",
  commitOnChange = false, "data-testid": testId, "aria-label": label,
}: PlannerDateInputProps) {
  const [draft, setDraft] = React.useState(() => formatWorkOrderDateDDMMYYYY(value));
  const [error, setError] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const lastCommitted = React.useRef(workOrderDateInputValue(value));
  const lastEmitted = React.useRef<string | undefined>(undefined);
  const picker = React.useRef<HTMLInputElement>(null);
  const errorId = React.useId();
  const blocked = disabled || saving;

  React.useEffect(() => {
    const canonical = workOrderDateInputValue(value);
    const echo = lastEmitted.current === canonical;
    lastEmitted.current = undefined;
    lastCommitted.current = canonical;
    if (!echo) {
      setDraft(formatWorkOrderDateDDMMYYYY(value));
      setError("");
    }
  }, [value]);

  const commit = async (selectedISO: string) => {
    if (blocked) return;
    const next = plannerDateCommitValue(value, selectedISO, lastCommitted.current);
    if (next === undefined) return;
    lastCommitted.current = next;
    lastEmitted.current = next;
    try {
      const pending = onChange(next);
      if (pending) {
        setSaving(true);
        await pending;
      }
    } catch {
      // The parent keeps its existing save-error toast; do not show a failed draft as saved.
      lastCommitted.current = workOrderDateInputValue(value);
      lastEmitted.current = undefined;
      setDraft(formatWorkOrderDateDDMMYYYY(value));
      setError("Planned date was not saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const commitDraft = () => {
    const next = plannerDateDraftValue(draft);
    if (next === undefined) {
      setError("Enter a valid date in DD-MM-YYYY format");
      return;
    }
    setError("");
    void commit(next);
  };

  return React.createElement("div", {
    className: containerClassName,
    onClick: (event: React.MouseEvent) => event.stopPropagation(),
  },
    React.createElement("div", { className: "relative" },
      React.createElement(Input, {
        type: "text", value: draft, disabled: blocked, placeholder: "DD-MM-YYYY",
        inputMode: "numeric", maxLength: 10,
        className: `h-7 min-w-0 pr-8 ${className} ${error ? "border-red-500" : ""}`,
        "data-testid": testId, "aria-label": label,
        "aria-invalid": Boolean(error), "aria-describedby": error ? errorId : undefined,
        title: error || undefined,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          const nextDraft = normalizeWorkOrderDateTyping(event.target.value);
          setDraft(nextDraft);
          setError("");
          if (commitOnChange) {
            // Only the bulk selection state is cleared, never a saved inline plan.
            void commit(plannerDateDraftValue(nextDraft) ?? "");
          }
        },
        onBlur: commitDraft,
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitDraft();
          } else if (event.key === "Escape") {
            event.preventDefault();
            setDraft(formatWorkOrderDateDDMMYYYY(value));
            setError("");
          }
        },
      }),
      !disabled && React.createElement("input", {
        ref: picker, type: "date", value: workOrderDateInputValue(value), disabled: saving,
        tabIndex: -1, "aria-hidden": true, className: "sr-only",
        "data-testid": `${testId}-picker`,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          const next = event.target.value;
          setDraft(formatWorkOrderDateDDMMYYYY(next));
          setError("");
          void commit(next);
        },
      }),
      !disabled && React.createElement("button", {
        type: "button", disabled: saving,
        className: "absolute inset-y-0 right-0 inline-flex w-8 items-center justify-center text-gray-500 disabled:opacity-50",
        "aria-label": `Open ${label} calendar`, "data-testid": `${testId}-picker-trigger`,
        // Opening the picker must not commit an unfinished manual draft on blur.
        onMouseDown: (event: React.MouseEvent) => event.preventDefault(),
        onClick: () => {
          if (typeof picker.current?.showPicker === "function") picker.current.showPicker();
          else picker.current?.click();
        },
      }, React.createElement(CalendarDays, { className: "h-3.5 w-3.5", "aria-hidden": true })),
    ),
    error && React.createElement("p", {
      id: errorId, role: "alert", className: "text-[10px] leading-tight text-red-600",
      "data-testid": `${testId}-error`,
    }, error),
  );
}
