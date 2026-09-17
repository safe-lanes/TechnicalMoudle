import React from 'react';
import { Input } from '@/components/ui/input';
import {
  formatWorkOrderDateDDMMYYYY,
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
  const visibleInputProps = {
    type: 'text',
    value: formatWorkOrderDateDDMMYYYY(value),
    readOnly: true,
    disabled,
    tabIndex: -1,
    placeholder,
    className: `${className} ${disabled ? '' : 'pointer-events-none'}`,
    'aria-hidden': !disabled,
    'aria-invalid': ariaInvalid,
    'data-testid': disabled ? testId : testId ? `${testId}-display` : undefined,
  } as React.ComponentProps<typeof Input>;

  return React.createElement(
    'div',
    { className: `relative ${containerClassName}` },
    React.createElement(Input, visibleInputProps),
    !disabled && React.createElement('input', {
      type: 'date',
      value: machineValue,
      max,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChange?.(event.target.value),
      className: 'absolute inset-0 h-full w-full cursor-pointer opacity-0',
      'aria-label': ariaLabel || 'Select date',
      'aria-invalid': ariaInvalid,
      'data-testid': testId,
    }),
  );
}