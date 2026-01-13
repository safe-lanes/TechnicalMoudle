import ExcelJS from 'exceljs';
import { db } from '../server/db';
import { components } from '../shared/schema';
import { eq } from 'drizzle-orm';

const VESSEL_1_ID = '743ef9d1-841a-11ed-aa7c-7003bca91a86';

async function exportVessel1Components() {
  console.log('Fetching components for Vessel 1...');
  
  const componentData = await db
    .select({
      componentCode: components.componentCode,
      name: components.name,
      model: components.model,
      maker: components.maker,
    })
    .from(components)
    .where(eq(components.vesselId, VESSEL_1_ID))
    .orderBy(components.componentCode);
  
  console.log(`Found ${componentData.length} components`);
  
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Seafarer PMS';
  workbook.created = new Date();
  
  const worksheet = workbook.addWorksheet('Vessel 1 Components');
  
  worksheet.columns = [
    { header: 'Component Code', key: 'componentCode', width: 20 },
    { header: 'Component Name', key: 'name', width: 50 },
    { header: 'Model', key: 'model', width: 25 },
    { header: 'Maker', key: 'maker', width: 30 },
  ];
  
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4472C4' }
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  
  for (const comp of componentData) {
    worksheet.addRow({
      componentCode: comp.componentCode || '',
      name: comp.name || '',
      model: comp.model || '',
      maker: comp.maker || '',
    });
  }
  
  const filename = 'Vessel1_Components.xlsx';
  await workbook.xlsx.writeFile(filename);
  
  console.log(`✅ Excel file saved: ${filename}`);
  console.log(`   Total components: ${componentData.length}`);
  
  process.exit(0);
}

exportVessel1Components().catch((err) => {
  console.error('Error exporting components:', err);
  process.exit(1);
});
