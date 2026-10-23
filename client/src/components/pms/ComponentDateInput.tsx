import React from "react";
import { WorkOrderDateInput } from "./WorkOrderDateInput";
import { componentDateChangeValue, formatComponentDate } from "@/lib/componentDatePresentation";
import { workOrderDateInputValue } from "@shared/dateUtils";

interface ComponentDateInputProps {
  value?: string | null;
  onChange?: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  min?: string;
  max?: string;
  id?: string;
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
  "data-testid"?: string;
  "aria-label"?: string;
}

/**
 * Numeric display over the existing date picker. Form state remains untouched
 * on mount/blur, and returning to the original day restores its exact raw value.
 */
export function ComponentDateInput({ value, onChange, min, max, id, style, readOnly, ...props }: ComponentDateInputProps) {
  const original = React.useRef(value);
  const lastEmitted = React.useRef<string | undefined>(undefined);
  const [rangeError, setRangeError] = React.useState("");

  React.useEffect(() => {
    if (lastEmitted.current !== undefined && value === lastEmitted.current) {
      lastEmitted.current = undefined;
      return;
    }
    original.current = value;
    lastEmitted.current = undefined;
    setRangeError("");
  }, [value]);

  const handleChange = (selectedISO: string) => {
    const minimum = workOrderDateInputValue(min);
    if (selectedISO && minimum && selectedISO < minimum) {
      setRangeError(`Date must be on or after ${formatComponentDate(min)}`);
      return;
    }
    setRangeError("");
    const next = componentDateChangeValue(original.current, selectedISO);
    if (next === (value ?? "")) return;
    lastEmitted.current = next;
    onChange?.(next);
  };

  return React.createElement(
    "div",
    { id, style },
    React.createElement(WorkOrderDateInput, {
      ...props,
      value,
      max: max ? workOrderDateInputValue(max) : undefined,
      disabled: props.disabled || readOnly,
      onChange: handleChange,
      "aria-invalid": Boolean(rangeError),
      placeholder: "DD-MM-YYYY",
    }),
    rangeError && React.createElement("p", {
      role: "alert",
      className: "mt-1 text-xs text-red-600",
    }, rangeError),
  );
}
