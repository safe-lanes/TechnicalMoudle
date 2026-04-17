import { forwardRef, useRef, useState, useEffect, useImperativeHandle, useCallback } from 'react';
import type { ICellEditorParams } from 'ag-grid-community';

interface DateCellEditorHandle {
  getValue: () => string;
  isCancelBeforeStart: () => boolean;
  isCancelAfterEnd: () => boolean;
  focusIn: () => void;
  isPopup: () => boolean;
}

function parseDisplayDate(displayDate: string): string {
  if (!displayDate) return '';
  
  const months: Record<string, string> = {
    'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
    'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
    'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
  };
  
  const match = displayDate.match(/(\d{1,2})\s([A-Za-z]{3})\s(\d{4})/);
  if (match) {
    const [, day, monthStr, year] = match;
    const month = months[monthStr] || '01';
    return `${year}-${month}-${day.padStart(2, '0')}`;
  }
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) {
    return displayDate;
  }
  
  return '';
}

function formatToDisplayDate(isoDate: string): string {
  if (!isoDate) return '';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  try {
    const [year, month, day] = isoDate.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    return `${day} ${months[monthIndex]} ${year}`;
  } catch {
    return isoDate;
  }
}

const DateCellEditor = forwardRef<DateCellEditorHandle, ICellEditorParams>((props, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const initialValue = parseDisplayDate(props.value || '');
  const [value, setValue] = useState(initialValue);
  const valueRef = useRef(value);
  const hasChangedRef = useRef(false);
  
  useEffect(() => {
    valueRef.current = value;
    hasChangedRef.current = value !== initialValue;
  }, [value, initialValue]);
  
  useEffect(() => {
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 0);
  }, []);
  
  useImperativeHandle(ref, () => ({
    getValue: () => {
      const result = formatToDisplayDate(valueRef.current);
      console.log('[DateCellEditor] getValue called, returning:', result);
      return result;
    },
    isCancelBeforeStart: () => false,
    isCancelAfterEnd: () => false,
    isPopup: () => false,
    focusIn: () => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }));
  
  const commitAndSave = useCallback((cancelled: boolean = false) => {
    if (cancelled || !hasChangedRef.current) {
      console.log('[DateCellEditor] No changes or cancelled, skipping save');
      props.stopEditing(cancelled);
      return;
    }
    
    const newDisplayValue = formatToDisplayDate(valueRef.current);
    const field = props.colDef?.field;
    const data = props.data;
    const compoundId = data?.vesselId && data?.masterId
      ? `${data.vesselId}::${data.masterId}`
      : data?.id;
    
    console.log('[DateCellEditor] Committing value:', newDisplayValue, 'for field:', field, 'id:', compoundId);
    
    if (field && compoundId && props.node && props.context?.onDateChange) {
      props.node.setDataValue(field, newDisplayValue);
      props.context.onDateChange(compoundId, field, newDisplayValue, data);
    }
    
    props.stopEditing();
  }, [props]);
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[DateCellEditor] handleChange called, new value:', e.target.value);
    setValue(e.target.value);
    valueRef.current = e.target.value;
    hasChangedRef.current = true;
  }, []);
  
  const handleBlur = useCallback(() => {
    // Read directly from input to avoid timing issues with AG Grid's editing lifecycle
    const currentInputValue = inputRef.current?.value || '';
    console.log('[DateCellEditor] handleBlur called, input value:', currentInputValue, 'ref value:', valueRef.current);
    
    // Update refs with current input value if different
    if (currentInputValue && currentInputValue !== valueRef.current) {
      valueRef.current = currentInputValue;
      hasChangedRef.current = currentInputValue !== initialValue;
    }
    
    commitAndSave(false);
  }, [commitAndSave, initialValue]);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitAndSave(false);
    } else if (e.key === 'Escape') {
      commitAndSave(true);
    }
  }, [commitAndSave]);
  
  return (
    <input
      ref={inputRef}
      type="date"
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-full h-full px-2 py-1 border-2 border-[#52baf3] rounded outline-none bg-white text-[13px] text-[#4f5863]"
      style={{ 
        fontFamily: '"Roboto", monospace',
        minWidth: '140px'
      }}
      data-testid={`date-editor-${props.data?.id}-${props.colDef?.field}`}
    />
  );
});

DateCellEditor.displayName = 'DateCellEditor';

export default DateCellEditor;
