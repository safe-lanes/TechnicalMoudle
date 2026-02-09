import * as XLSX from 'xlsx';

const COMPONENT_HEADERS = [
  'Fleet Equipment Code',
  'Fleet Equipment Name',
  'Parent Component Code',
  'Component Code',
  'Component Name',
  'Component Category',
  'Maker',
  'Maker Code',
  'Model',
  'Model Code',
  'Serial No',
  'Drawing No',
  'Location',
  'Criticality',
  'Condition Based',
  'Installation Date',
  'Commissioned Date',
  'Rating',
  'Equipment / System Department',
  'Class item',
  'IS Active',
  'Vessel Code',
  'IS Parent',
  'Notes',
  'RH Counter Type',
  'RH Counter Source',
  'Running Hours',
  'Last Updated',
];

const VALID_VALUES_ROW: Record<string, string> = {
  'Criticality': 'Yes / No',
  'Condition Based': 'Yes / No',
  'IS Active': 'Yes / No',
  'IS Parent': 'Yes / No',
  'Class item': 'Yes / No',
  'RH Counter Type': 'MASTER / INHERITED / NOT_RH_DRIVEN',
  'Installation Date': 'DD-MMM-YYYY',
  'Commissioned Date': 'DD-MMM-YYYY',
  'Last Updated': 'DD-MMM-YYYY',
  'Running Hours': 'Numeric (e.g. 1500.50)',
  'Component Code': 'SFI format (e.g. 711.001)',
  'Parent Component Code': 'SFI format (e.g. 711)',
};

export class BulkTemplateService {
  generateComponentTemplate(): Buffer {
    const wb = XLSX.utils.book_new();

    const headerRow = COMPONENT_HEADERS;
    const validRow = COMPONENT_HEADERS.map(h => VALID_VALUES_ROW[h] || '');

    const wsData = [headerRow, validRow];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const colWidths = COMPONENT_HEADERS.map(h => ({ wch: Math.max(h.length + 2, 15) }));
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Components');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buf;
  }
}
