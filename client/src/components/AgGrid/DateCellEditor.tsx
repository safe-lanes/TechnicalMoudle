import { Component, createRef } from 'react';
import type { ICellEditorParams } from 'ag-grid-community';

interface DateCellEditorState {
  value: string;
}

class DateCellEditor extends Component<ICellEditorParams, DateCellEditorState> {
  private inputRef = createRef<HTMLInputElement>();
  
  constructor(props: ICellEditorParams) {
    super(props);
    this.state = {
      value: this.parseDisplayDate(props.value || '')
    };
  }
  
  parseDisplayDate(displayDate: string): string {
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
  
  formatToDisplayDate(isoDate: string): string {
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
  
  componentDidMount() {
    setTimeout(() => {
      if (this.inputRef.current) {
        this.inputRef.current.focus();
        this.inputRef.current.select();
      }
    }, 0);
  }
  
  getValue() {
    return this.formatToDisplayDate(this.state.value);
  }
  
  isCancelBeforeStart() {
    return false;
  }
  
  isCancelAfterEnd() {
    return false;
  }
  
  focusIn() {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }
  
  handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ value: e.target.value });
  };
  
  handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      this.props.stopEditing();
    } else if (e.key === 'Escape') {
      this.props.stopEditing(true);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.props.stopEditing();
      if (this.props.api) {
        if (e.shiftKey) {
          this.props.api.tabToPreviousCell();
        } else {
          this.props.api.tabToNextCell();
        }
      }
    }
  };
  
  render() {
    return (
      <input
        ref={this.inputRef}
        type="date"
        value={this.state.value}
        onChange={this.handleChange}
        onKeyDown={this.handleKeyDown}
        className="w-full h-full px-2 py-1 border-2 border-[#52baf3] rounded outline-none bg-white text-[13px] text-[#4f5863]"
        style={{ 
          fontFamily: 'Inter, sans-serif',
          minWidth: '140px'
        }}
        data-testid={`date-editor-${this.props.data?.id}-${this.props.colDef?.field}`}
      />
    );
  }
}

export default DateCellEditor;
