import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { WorkOrderDateInput } from '@/components/pms/WorkOrderDateInput';

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) =>
    React.createElement('input', props),
}));

describe('WorkOrderDateInput', () => {
  it('renders DD-MM-YYYY visibly while keeping an editable YYYY-MM-DD picker', () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkOrderDateInput, {
        value: '2026-09-18',
        onChange: () => undefined,
        'data-testid': 'work-order-date',
      }),
    );

    expect(markup).toContain('value="18-09-2026"');
    expect(markup).toContain('type="date"');
    expect(markup).toContain('value="2026-09-18"');
    expect(markup).toContain('data-testid="work-order-date-display"');
    expect(markup).toContain('data-testid="work-order-date"');
    expect(markup).toContain('data-testid="work-order-date-picker-icon"');
    expect(markup).toContain('aria-label="Select date"');
    expect(markup).toContain('cursor-pointer');
  });

  it('renders a disabled date as DD-MM-YYYY without an editable picker', () => {
    const markup = renderToStaticMarkup(
      React.createElement(WorkOrderDateInput, {
        value: '18-Sep-2026',
        disabled: true,
        'data-testid': 'work-order-date',
      }),
    );

    expect(markup).toContain('value="18-09-2026"');
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('type="date"');
    expect(markup).not.toContain('work-order-date-picker-icon');
  });
});