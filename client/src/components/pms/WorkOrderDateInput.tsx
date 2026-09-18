import React from 'react';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  formatWorkOrderDateDDMMYYYY,
  normalizeWorkOrderDateTyping,
  parseWorkOrderDateDDMMYYYYInput,
  workOrderDateInputValue,
} from '@shared/dateUtils';

interface WorkOrderDateInputProps {
  value: string | null | undefined;
  onChange?: (value: string) => void;
  disabled?: boolean;
  max?: string;
  className?: string;
  containerClassName?: string;
  placeholder?: string;
  'data-testid'?: string;
  'aria-invalid'?: boolean;
  'aria-label'?: string;
}

/**
 * Keeps a native YYYY-MM-DD date picker for editing while rendering the
 * visible value explicitly as DD-MM-YYYY in every browser and locale.
 */
export function WorkOrderDateInput({
  value,
  onChange,
  disabled = false,
  max,
  className = '',
  containerClassName = '',
  placeholder = 'DD-MM-YYYY',
  'data-testid': testId,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel,
}: WorkOrderDateInputProps) {
  const machineValue = workOrderDateInputValue(value);
  const [draftValue, setDraftValue] = React.useState(() => formatWorkOrderDateDDMMYYYY(value));
  const [manualError, setManualError] = React.useState('');
  const inputId = React.useId();
  const errorId = `${inputId}-error`;
  const lastEmittedValue = React.useRef<string | null>(null);
  const pickerRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const canonicalValue = workOrderDateInputValue(value);
    if (lastEmittedValue.current === canonicalValue) {
      lastEmittedValue.current = null;
      return;
    }
    setDraftValue(formatWorkOrderDateDDMMYYYY(value));
    setManualError('');
  }, [value]);

  const emitChange = (canonicalValue: string) => {
    lastEmittedValue.current = canonicalValue;
    onChange?.(canonicalValue);
  };

  const handleManualChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDraft = normalizeWorkOrderDateTyping(event.target.value);
    setDraftValue(nextDraft);

    if (!nextDraft) {
      setManualError('');
      emitChange('');
      return;
    }

    if (nextDraft.length < 10) {
      setManualError('');
      if (machineValue) emitChange('');
      return;
    }

    const canonicalDate = parseWorkOrderDateDDMMYYYYInput(nextDraft);
    const exceedsMax = Boolean(canonicalDate && max && canonicalDate > max);
    if (!canonicalDate || exceedsMax) {
      setManualError(exceedsMax
        ? `Date must be on or before ${formatWorkOrderDateDDMMYYYY(max)}`
        : 'Enter a valid date in DD-MM-YYYY format');
      if (machineValue) emitChange('');
      return;
    }

    setManualError('');
    emitChange(canonicalDate);
  };

  const handleManualBlur = () => {
    if (draftValue && !parseWorkOrderDateDDMMYYYYInput(draftValue)) {
      setManualError('Enter a valid date in DD-MM-YYYY format');
    }
  };

  const openDatePicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;

    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
      return;
    }

    // Older browsers do not expose showPicker(), but still open the native
    // date control when it receives a click from this user interaction.
    picker.click();
  };

  const invalid = Boolean(ariaInvalid || manualError);
  const visibleInputProps = {
    type: 'text',
    value: disabled ? formatWorkOrderDateDDMMYYYY(value) : draftValue,
    onChange: disabled ? undefined : handleManualChange,
    onBlur: disabled ? undefined : handleManualBlur,
    inputMode: 'numeric',
    disabled,
    placeholder,
    maxLength: 10,
    className: `${className} ${disabled ? '' : 'pr-10'} ${manualError ? 'border-red-500 focus-visible:ring-red-500' : ''}`,
    'aria-label': ariaLabel,
    'aria-invalid': invalid,
    'aria-describedby': manualError ? errorId : undefined,
    'data-testid': testId,
  } as React.ComponentProps<typeof Input>;

  return React.createElement(
    'div',
    { className: containerClassName },
    React.createElement(
      'div',
      { className: 'relative' },
      React.createElement(Input, visibleInputProps),
      !disabled && React.createElement('input', {
        ref: pickerRef,
        type: 'date',
        value: machineValue,
        max,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
          setManualError('');
          setDraftValue(formatWorkOrderDateDDMMYYYY(event.target.value));
          emitChange(event.target.value);
        },
        className: 'sr-only',
        tabIndex: -1,
        'aria-hidden': true,
        'aria-invalid': invalid,
        'data-testid': testId ? `${testId}-picker` : undefined,
      }),
      !disabled && React.createElement(
        'button',
        {
          type: 'button',
          onClick: openDatePicker,
          className: 'absolute inset-y-0 right-0 z-10 inline-flex w-10 cursor-pointer items-center justify-center rounded-r-md text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'aria-label': ariaLabel ? `Open ${ariaLabel} calendar` : 'Open date picker',
          'data-testid': testId ? `${testId}-picker-trigger` : undefined,
        },
        React.createElement(CalendarDays, {
          className: 'h-4 w-4',
          'aria-hidden': true,
          'data-testid': testId ? `${testId}-picker-icon` : undefined,
        }),
      ),
    ),
    manualError && React.createElement(
      'p',
      {
        id: errorId,
        className: 'mt-1 text-xs text-red-600',
        role: 'alert',
        'data-testid': testId ? `${testId}-error` : undefined,
      },
      manualError,
    ),
  );
}