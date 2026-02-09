import { parse, format, isValid, addMonths, addYears, addWeeks, addDays } from 'date-fns';

export function normalizeDateToDDMMMYYYY(dateInput: string | number | Date | null | undefined): string | null {
  if (!dateInput) return null;
  
  try {
    let parsedDate: Date;
    
    if (typeof dateInput === 'number') {
      let adjustedSerial = dateInput;
      if (dateInput >= 60) {
        adjustedSerial = dateInput - 1;
      }
      const excelEpoch = new Date(1899, 11, 31);
      parsedDate = new Date(excelEpoch.getTime() + adjustedSerial * 24 * 60 * 60 * 1000);
    } else if (dateInput instanceof Date) {
      parsedDate = dateInput;
    } else {
      const dateString = String(dateInput).trim();
      
      const numericValue = parseFloat(dateString);
      if (!isNaN(numericValue) && /^\d+(\.\d+)?$/.test(dateString) && numericValue > 1000 && numericValue < 100000) {
        let adjustedSerial = numericValue;
        if (numericValue >= 60) {
          adjustedSerial = numericValue - 1;
        }
        const excelEpoch = new Date(1899, 11, 31);
        parsedDate = new Date(excelEpoch.getTime() + adjustedSerial * 24 * 60 * 60 * 1000);
      } else {
        parsedDate = parse(dateString, 'dd-MMM-yyyy', new Date());
        if (!isValid(parsedDate)) {
          parsedDate = parse(dateString, 'dd/MM/yyyy', new Date());
        }
        if (!isValid(parsedDate)) {
          parsedDate = parse(dateString, 'dd-MM-yyyy', new Date());
        }
        if (!isValid(parsedDate)) {
          parsedDate = parse(dateString, 'yyyy-MM-dd', new Date());
        }
        if (!isValid(parsedDate)) {
          parsedDate = new Date(dateString);
        }
      }
    }
    
    if (!isValid(parsedDate)) {
      return null;
    }
    
    const year = parsedDate.getFullYear();
    if (year < 1900 || year > 2100) {
      return null;
    }
    
    return format(parsedDate, 'dd-MMM-yyyy');
  } catch (error) {
    return null;
  }
}

export function calculateNextDueDate(lastDoneDate: string, frequencyValue: string | number, frequencyUnit: string): string | null {
  try {
    const parsedDate = parse(lastDoneDate, 'dd-MMM-yyyy', new Date());
    if (!isValid(parsedDate)) return null;

    const freq = typeof frequencyValue === 'string' ? parseInt(frequencyValue, 10) : frequencyValue;
    if (isNaN(freq) || freq <= 0) return null;

    let nextDate: Date;
    switch (frequencyUnit) {
      case 'Months': nextDate = addMonths(parsedDate, freq); break;
      case 'Years': nextDate = addYears(parsedDate, freq); break;
      case 'Weeks': nextDate = addWeeks(parsedDate, freq); break;
      case 'Days': nextDate = addDays(parsedDate, freq); break;
      default: return null;
    }

    return format(nextDate, 'dd-MMM-yyyy');
  } catch { return null; }
}
