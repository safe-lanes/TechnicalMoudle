import XLSX from 'xlsx';
const workbook = XLSX.readFile('C:/Users/GhaziAnwer/Downloads/PMS_Architecture_Review_new.xlsx');
console.log('Sheets:', workbook.SheetNames);
for (const name of workbook.SheetNames) {
  const sheet = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<any>(sheet);
  console.log(`\n=== Sheet: ${name} (${rows.length} rows) ===`);
  console.log('Columns:', Object.keys(rows[0] || {}));
  rows.forEach((row: any, i: number) => {
    console.log(`\n--- Row ${i+1} ---`);
    for (const [k, v] of Object.entries(row)) {
      console.log(`  ${k}: ${v}`);
    }
  });
}
