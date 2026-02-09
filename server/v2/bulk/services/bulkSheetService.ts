import * as XLSX from 'xlsx';

export class BulkSheetService {
  getSheets(file: { buffer: Buffer; originalname: string }): string[] {
    const ext = file.originalname.toLowerCase();

    if (ext.endsWith('.csv')) {
      return ['Sheet1'];
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    return workbook.SheetNames;
  }
}
