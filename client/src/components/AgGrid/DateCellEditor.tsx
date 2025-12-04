import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react';
import type { ICellEditorParams, ICellEditorComp } from 'ag-grid-community';

interface DateCellEditorProps extends ICellEditorParams {
  onDateChange?: (id: string, field: string, newValue: string) => void;
}

const DateCellEditor = forwardRef((props: DateCellEditorProps, ref) => {
  const inputRef = useRef<HTMLInputElement>(null);
  
  const parseDisplayDate = (displayDate: string): string => {
    if (!displayDate) return '';
    
    const months: Record<string, string> = {
      'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
      'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
      'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
    };
    
    const match = displayDate.match(/(\d{2})\s([A-Za-z]{3})\s(\d{4})/);
    if (match) {
      const [, day, monthStr, year] = match;
      const month = months[monthStr] || '01';
      return `${year}-${month}-${day}`;
    }
    
    if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) {
      return displayDate;
    }
    
    return '';
  };
  
  const formatToDisplayDate = (isoDate: string): string => {
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
  };
  
  const [value, setValue] = useState(() => parseDisplayDate(props.value || ''));
  
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);
  
  useImperativeHandle(ref, () => ({
    getValue() {
      return formatToDisplayDate(value);
    },
    
    isCancelBeforeStart() {
      return false;
    },
    
    isCancelAfterEnd() {
      return false;
    },
    
    focusIn() {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    },
    
    focusOut() {
    }
  }));
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      props.stopEditing();
    } else if (e.key === 'Escape') {
      props.stopEditing(true);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      props.stopEditing();
      if (props.api) {
        if (e.shiftKey) {
          props.api.tabToPreviousCell();
        } else {
          props.api.tabToNextCell();
        }
      }
    }
  };
  
  return (
    <input
      ref={inputRef}
      type="date"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      className="w-full h-full px-2 py-1 border-2 border-[#52baf3] rounded outline-none bg-white text-[13px] text-[#4f5863]"
      style={{ 
        fontFamily: 'Inter, sans-serif',
        minWidth: '140px'
      }}
      data-testid={`date-editor-${props.data?.id}-${props.colDef?.field}`}
    />
  );
});

DateCellEditor.displayName = 'DateCellEditor';

export default DateCellEditor;
