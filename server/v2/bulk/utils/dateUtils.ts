import { parse, format, isValid } from 'date-fns';

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
