import ExcelJS from 'exceljs';
import * as repo from '../repositories/reportRepository';
import { lowStockReportService } from '../../../services/lowStockReportService';
import {
  COLORS,
  applyStandardHeader,
  applyStandardTableHeader,
  applyStandardDataRows,
  applyStandardPageSetup,
  generateFilename,
  getLastColumnLetter,
  type ColumnDef,
} from '../../../lib/excelReportStyles';

// ═══════════════════════════════════════════════════════════════
// STORES INVENTORY STATUS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportStoresInventoryStatusExcel(
  vesselId: string,
  tab: string | undefined,
  categoryFilter: string | undefined,
  statusFilter: string | undefined,
  componentFilter?: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const allVessels = await repo.getVessels();
  let allItems: any[];
  if (vesselId === 'all') {
    allItems = [];
    for (const vessel of allVessels) {
      allItems = allItems.concat(await repo.getStoresItems(vessel.id));
    }
  } else {
    allItems = await repo.getStoresItems(vesselId);
  }
  const vessel = allVessels.find((v: any) => v.id === vesselId);
  const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);

  let items = allItems.filter((item: any) => item.deleted !== true && item.isActive !== false);

  if (categoryFilter && categoryFilter !== 'all') {
    if (categoryFilter === 'lubricants' || categoryFilter === 'lubes') {
      items = items.filter((i: any) => i.itemType === 'lubes' || i.itemType === 'lubricants');
    } else if (categoryFilter === 'others') {
      items = items.filter((i: any) => !['stores', 'lubes', 'lubricants', 'chemicals'].includes(i.itemType));
    } else {
      items = items.filter((i: any) => i.itemType === categoryFilter);
    }
  }

  if (statusFilter && statusFilter !== 'all') {
    items = items.filter((i: any) => {
      const rob = parseFloat(String(i.rob)) || 0;
      const min = parseFloat(String(i.min)) || 0;
      if (rob === 0) return statusFilter === 'Critical';
      if (rob <= min) return statusFilter === 'Low';
      return statusFilter === 'OK';
    });
  }

  if (componentFilter && componentFilter.trim()) {
    const cf = componentFilter.toLowerCase();
    items = items.filter((i: any) =>
      (i.itemName || '').toLowerCase().includes(cf) ||
      (i.itemCode || '').toLowerCase().includes(cf) ||
      (i.componentName || '').toLowerCase().includes(cf)
    );
  }

  const categoryDisplayMap: Record<string, string> = {
    stores: 'Stores', lubes: 'Lubricants', lubricants: 'Lubricants',
    chemicals: 'Chemicals', others: 'Others',
  };

  let ledger: any[];
  if (vesselId === 'all') {
    ledger = [];
    for (const v of allVessels) {
      ledger = ledger.concat(await repo.getStoresTransactionHistory(v.id));
    }
  } else {
    ledger = await repo.getStoresTransactionHistory(vesselId);
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

  const consumptionMap: Record<number, { total30: number; first15: number; last15: number }> = {};
  (ledger || []).forEach((entry: any) => {
    if (entry.eventType !== 'CONSUME') return;
    const entryDate = entry.timestampUTC ? new Date(entry.timestampUTC) : (entry.dateLocal ? new Date(entry.dateLocal) : null);
    if (!entryDate || entryDate < thirtyDaysAgo) return;
    const itemId = entry.itemId;
    if (!consumptionMap[itemId]) consumptionMap[itemId] = { total30: 0, first15: 0, last15: 0 };
    const qty = Math.abs(parseFloat(String(entry.qtyChangeBase)) || 0);
    consumptionMap[itemId].total30 += qty;
    if (entryDate >= fifteenDaysAgo) {
      consumptionMap[itemId].last15 += qty;
    } else {
      consumptionMap[itemId].first15 += qty;
    }
  });

  const getTrend = (itemId: number): string => {
    const data = consumptionMap[itemId];
    if (!data || (data.first15 === 0 && data.last15 === 0)) return 'Stable';
    if (data.last15 > data.first15 * 1.1) return 'Increasing';
    if (data.first15 > data.last15 * 1.1) return 'Decreasing';
    return 'Stable';
  };

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();

  let columns: ColumnDef[];
  let rowsData: any[][];
  let sheetName: string;
  let reportTitle: string;
  let subtitle: string;
  let statusBgColors: Record<string, string> = {};
  let statusFontColors: Record<string, string> = {};
  let statusColIndex = -1;

  if (tab === 'consumption') {
    sheetName = 'Consumption Trends';
    reportTitle = 'STORES INVENTORY STATUS - CONSUMPTION TRENDS';
    columns = [
      { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
      { key: 'itemCode', header: 'Item Code', width: 18 },
      { key: 'itemName', header: 'Item Name', width: 35 },
      { key: 'category', header: 'Category', width: 18 },
      { key: 'rob', header: 'Current ROB', width: 14, type: 'number', align: 'right' },
      { key: 'consumption30', header: '30 Day Consumption', width: 18, type: 'number', align: 'right' },
      { key: 'avgMonthly', header: 'Avg Monthly', width: 16, type: 'number', align: 'right' },
      { key: 'trend', header: 'Trend', width: 14, align: 'center' },
    ];

    rowsData = items.map((item: any, idx: number) => {
      const rob = parseFloat(String(item.rob)) || 0;
      const consumption = consumptionMap[item.id]?.total30 || 0;
      const trend = getTrend(item.id);
      return [idx + 1, item.itemCode || '-', item.itemName || '-', categoryDisplayMap[item.itemType] || item.itemType || '-', rob, parseFloat(consumption.toFixed(2)), parseFloat(consumption.toFixed(2)), trend];
    });

    subtitle = `Total Items: ${items.length}`;
  } else if (tab === 'reorder') {
    sheetName = 'Reorder Requirements';
    reportTitle = 'STORES INVENTORY STATUS - REORDER REQUIREMENTS';
    columns = [
      { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
      { key: 'itemCode', header: 'Item Code', width: 18 },
      { key: 'itemName', header: 'Item Name', width: 35 },
      { key: 'category', header: 'Category', width: 18 },
      { key: 'rob', header: 'Current ROB', width: 14, type: 'number', align: 'right' },
      { key: 'avgMonthly', header: 'Avg Monthly', width: 16, type: 'number', align: 'right' },
      { key: 'daysToStockout', header: 'Days to Stockout', width: 18, type: 'number', align: 'right' },
      { key: 'suggestedQty', header: 'Suggested Qty', width: 16, type: 'number', align: 'right' },
    ];

    const reorderItems = items
      .map((item: any) => {
        const rob = parseFloat(String(item.rob)) || 0;
        const min = parseFloat(String(item.min)) || 0;
        const monthlyConsumption = consumptionMap[item.id]?.total30 || 0;
        const dailyConsumption = monthlyConsumption / 30;
        const daysUntilStockout = dailyConsumption > 0 ? rob / dailyConsumption : Infinity;
        const suggestedQty = Math.max(0, (min * 2) - rob);
        let priority: string;
        if (daysUntilStockout < 7) priority = 'Critical';
        else if (daysUntilStockout < 14) priority = 'High';
        else if (daysUntilStockout < 30) priority = 'Medium';
        else priority = 'Low';
        return { ...item, rob, min, monthlyConsumption, daysUntilStockout, priority, suggestedQty };
      })
      .filter((item: any) => (item.rob - item.monthlyConsumption) <= item.min);

    rowsData = reorderItems.map((item: any, idx: number) => {
      const daysStr = !isFinite(item.daysUntilStockout) || item.daysUntilStockout > 365 ? '>365' : Math.round(item.daysUntilStockout);
      return [idx + 1, item.itemCode || '-', item.itemName || '-', categoryDisplayMap[item.itemType] || item.itemType || '-', item.rob, parseFloat(item.monthlyConsumption.toFixed(2)), daysStr, parseFloat(item.suggestedQty.toFixed(1))];
    });

    subtitle = `Reorder Items: ${reorderItems.length}`;
  } else {
    sheetName = 'Stock Status';
    reportTitle = 'STORES INVENTORY STATUS - STOCK STATUS';
    columns = [
      { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
      { key: 'itemCode', header: 'Item Code', width: 18 },
      { key: 'itemName', header: 'Item Name', width: 35 },
      { key: 'category', header: 'Category', width: 18 },
      { key: 'rob', header: 'Current ROB', width: 14, type: 'number', align: 'right' },
      { key: 'min', header: 'Min Stock', width: 14, type: 'number', align: 'right' },
      { key: 'status', header: 'Status', width: 14, align: 'center' },
      { key: 'locationA', header: 'Location A', width: 18 },
      { key: 'locationB', header: 'Location B', width: 18 },
      { key: 'uom', header: 'UOM', width: 12 },
    ];

    statusColIndex = 7;
    statusBgColors = { 'Critical': 'FFFFF1F0', 'Low': 'FFFFFBE6', 'OK': 'FFFFFFFF' };
    statusFontColors = { 'Critical': 'FFF5222D', 'Low': 'FFFAAD14', 'OK': 'FF5A6C7D' };

    rowsData = items.map((item: any, idx: number) => {
      const rob = parseFloat(String(item.rob)) || 0;
      const min = parseFloat(String(item.min)) || 0;
      let status: string;
      if (rob === 0) status = 'Critical';
      else if (rob <= min) status = 'Low';
      else status = 'OK';
      return [idx + 1, item.itemCode || '-', item.itemName || '-', categoryDisplayMap[item.itemType] || item.itemType || '-', rob, min, status, item.locationA || '-', item.locationB || '-', item.uom || '-'];
    });

    const critCount = rowsData.filter(r => r[6] === 'Critical').length;
    const lowCount = rowsData.filter(r => r[6] === 'Low').length;
    subtitle = `Total Items: ${rowsData.length} | Critical: ${critCount} | Low: ${lowCount}`;
  }

  const worksheet = workbook.addWorksheet(sheetName);
  const totalColumns = columns.length;
  const lastColLetter = getLastColumnLetter(totalColumns);

  applyStandardHeader(worksheet, reportTitle, subtitle, vesselName, rowsData.length, lastColLetter);

  const headerRowNum = 7;
  applyStandardTableHeader(worksheet, columns, headerRowNum);

  rowsData.forEach((rowData, idx) => {
    const row = worksheet.addRow(rowData);
    row.height = 20;

    const statusVal = statusColIndex > 0 ? String(rowData[statusColIndex - 1]) : '';
    const bgColor = statusBgColors[statusVal] || 'FFFFFFFF';

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colDef = columns[colNumber - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? bgColor : COLORS.bgLight } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        right: { style: 'thin', color: { argb: COLORS.border } },
      };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };

      if (colNumber === statusColIndex) {
        const fontColor = statusFontColors[statusVal];
        if (fontColor) {
          cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: fontColor } };
        }
      }
    });
  });

  worksheet.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: headerRowNum, column: totalColumns }
  };

  applyStandardPageSetup(worksheet, headerRowNum, totalColumns, 6, vesselName);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = generateFilename('StoresInventoryStatus', vesselName);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// STORES CONSUMPTION ANALYSIS - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getStoresConsumptionAnalysis(
  vesselId: string,
  startDate: string | undefined,
  endDate: string | undefined,
  itemType: string | undefined,
  category: string | undefined,
  vesselIds?: string[],
) {
  const allVessels = await repo.getVessels();
  let allHistory: any[];
  let allItems: any[];
  if (vesselId === 'all') {
    const vessels = vesselIds?.length ? allVessels.filter((v: any) => vesselIds.includes(v.id)) : allVessels;
    allHistory = []; allItems = [];
    for (const vessel of vessels) {
      allHistory = allHistory.concat(await repo.getStoresTransactionHistory(vessel.id));
      allItems = allItems.concat(await repo.getStoresItems(vessel.id));
    }
  } else {
    allHistory = await repo.getStoresTransactionHistory(vesselId);
    allItems = await repo.getStoresItems(vesselId);
  }
  const vessel = allVessels.find((v: any) => v.id === vesselId);
  const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);
  const itemsMap = new Map(allItems.map((item: any) => [item.id, item]));

  let consumeEvents = allHistory.filter((h: any) => h.eventType === 'CONSUME');
  let allLedgerEvents = allHistory;

  if (startDate) {
    const sd = new Date(startDate);
    consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) >= sd);
    allLedgerEvents = allLedgerEvents.filter((h: any) => new Date(h.timestampUTC) >= sd);
  }
  if (endDate) {
    const ed = new Date(endDate);
    ed.setHours(23, 59, 59, 999);
    consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) <= ed);
    allLedgerEvents = allLedgerEvents.filter((h: any) => new Date(h.timestampUTC) <= ed);
  }
  if (itemType && itemType !== 'all') {
    consumeEvents = consumeEvents.filter((h: any) => h.section === itemType);
    allLedgerEvents = allLedgerEvents.filter((h: any) => h.section === itemType);
  }
  if (category && category !== 'all') {
    const catItemIds = new Set(allItems.filter((i: any) => i.category === category).map((i: any) => i.id));
    consumeEvents = consumeEvents.filter((h: any) => catItemIds.has(h.itemId));
    allLedgerEvents = allLedgerEvents.filter((h: any) => catItemIds.has(h.itemId));
  }

  const dates = consumeEvents.map((h: any) => new Date(h.timestampUTC)).filter((d: Date) => !isNaN(d.getTime()));
  const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map((d: Date) => d.getTime()))) : new Date();
  const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map((d: Date) => d.getTime()))) : new Date();
  const daysOfData = Math.max(1, Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));

  let confidenceLevel: 'low' | 'medium' | 'high' = 'low';
  if (daysOfData > 90) confidenceLevel = 'high';
  else if (daysOfData >= 30) confidenceLevel = 'medium';

  const monthlyMap: Record<string, { totalQty: number; eventCount: number; itemIds: Set<number>; byType: Record<string, number> }> = {};
  for (const h of consumeEvents) {
    const d = new Date(h.timestampUTC);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[monthKey]) {
      monthlyMap[monthKey] = { totalQty: 0, eventCount: 0, itemIds: new Set(), byType: {} };
    }
    const qty = Math.abs(parseFloat(String(h.qtyChangeBase)) || 0);
    monthlyMap[monthKey].totalQty += qty;
    monthlyMap[monthKey].eventCount += 1;
    monthlyMap[monthKey].itemIds.add(h.itemId);
    const section = h.section || 'stores';
    monthlyMap[monthKey].byType[section] = (monthlyMap[monthKey].byType[section] || 0) + qty;
  }

  const consumptionTrends = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      totalQty: Math.round(data.totalQty * 100) / 100,
      eventCount: data.eventCount,
      itemCount: data.itemIds.size,
      byType: {
        stores: Math.round((data.byType['stores'] || 0) * 100) / 100,
        lubricants: Math.round((data.byType['lubricants'] || data.byType['lubes'] || 0) * 100) / 100,
        chemicals: Math.round((data.byType['chemicals'] || 0) * 100) / 100,
        others: Math.round((data.byType['others'] || 0) * 100) / 100,
      }
    }));

  const itemGrouped: Record<number, { totalConsumed: number; events: number; lastConsumed: Date; robSnapshots: number[] }> = {};
  for (const h of consumeEvents) {
    const key = h.itemId;
    if (!itemGrouped[key]) {
      itemGrouped[key] = { totalConsumed: 0, events: 0, lastConsumed: new Date(h.timestampUTC), robSnapshots: [] };
    }
    const qty = Math.abs(parseFloat(String(h.qtyChangeBase)) || 0);
    itemGrouped[key].totalConsumed += qty;
    itemGrouped[key].events += 1;
    const robAfter = parseFloat(String(h.robAfterBase)) || 0;
    itemGrouped[key].robSnapshots.push(robAfter);
    const ts = new Date(h.timestampUTC);
    if (ts > itemGrouped[key].lastConsumed) {
      itemGrouped[key].lastConsumed = ts;
    }
  }

  const topConsumedItems = Object.entries(itemGrouped)
    .map(([itemIdStr, g]) => {
      const itemId = Number(itemIdStr);
      const item = itemsMap.get(itemId);
      const currentRob = parseFloat(String(item?.rob)) || 0;
      const minStock = parseFloat(String(item?.min)) || 0;
      const rawMonthlyRate = daysOfData > 0 ? (g.totalConsumed / daysOfData) * 30 : 0;
      let confidenceMultiplier = 1.0;
      if (daysOfData < 7) confidenceMultiplier = 0.5;
      else if (daysOfData < 30) confidenceMultiplier = 0.75;
      const avgMonthlyConsumption = Math.round(rawMonthlyRate * confidenceMultiplier * 100) / 100;
      return {
        itemId,
        itemCode: item?.itemCode || '',
        itemName: item?.itemName || '',
        itemType: item?.itemType || '',
        category: item?.category || '',
        uom: item?.uom || '',
        totalConsumed: Math.round(g.totalConsumed * 100) / 100,
        eventCount: g.events,
        avgMonthlyConsumption,
        rawAvgMonthlyConsumption: Math.round(rawMonthlyRate * 100) / 100,
        confidenceMultiplier,
        adjustmentNote: daysOfData < 7
          ? `Adjusted estimate (\u00d7${confidenceMultiplier}) based on limited ${daysOfData}-day sample. Raw rate: ${Math.round(rawMonthlyRate * 100) / 100}/month`
          : daysOfData < 30
            ? `Adjusted estimate (\u00d7${confidenceMultiplier}) based on ${daysOfData}-day sample. Raw rate: ${Math.round(rawMonthlyRate * 100) / 100}/month`
            : null,
        currentRob,
        minStock,
        lastConsumedDate: g.lastConsumed.toISOString(),
        hasSingleEvent: g.events === 1,
      };
    })
    .sort((a, b) => b.totalConsumed - a.totalConsumed);

  const categoryMap: Record<string, { totalQty: number; itemCount: Set<number>; itemType: string }> = {};
  for (const h of consumeEvents) {
    const item = itemsMap.get(h.itemId);
    const cat = item?.category || item?.itemType || 'Uncategorized';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { totalQty: 0, itemCount: new Set(), itemType: item?.itemType || '' };
    }
    categoryMap[cat].totalQty += Math.abs(parseFloat(String(h.qtyChangeBase)) || 0);
    categoryMap[cat].itemCount.add(h.itemId);
  }

  const totalConsumptionQty = Object.values(categoryMap).reduce((sum, c) => sum + c.totalQty, 0);
  const categoryBreakdown = Object.entries(categoryMap)
    .map(([cat, data]) => ({
      category: cat,
      itemType: data.itemType,
      totalQty: Math.round(data.totalQty * 100) / 100,
      itemCount: data.itemCount.size,
      percentage: totalConsumptionQty > 0 ? Math.round((data.totalQty / totalConsumptionQty) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.totalQty - a.totalQty);

  const stockEfficiency = allItems
    .filter((item: any) => !item.deleted && item.isActive !== false)
    .map((item: any) => {
      const itemId = item.id;
      const consumed = itemGrouped[itemId];
      const totalConsumed = consumed?.totalConsumed || 0;
      const currentRob = parseFloat(String(item.rob)) || 0;
      const minStock = parseFloat(String(item.min)) || 0;
      const robSnapshots = consumed?.robSnapshots || [];
      const avgRob = robSnapshots.length > 0
        ? robSnapshots.reduce((s: number, v: number) => s + v, 0) / robSnapshots.length
        : currentRob;
      const stockTurnoverRatio = avgRob > 0 ? Math.round((totalConsumed / avgRob) * 100) / 100 : 0;

      const eventCount = consumed?.events || 0;
      const consumptionFrequency = daysOfData > 0 ? eventCount / daysOfData : 0;
      const stockHealthRatio = minStock > 0 ? currentRob / minStock : null;

      let movementSpeed: 'fast' | 'slow' | 'very-slow' | 'non-moving' = 'non-moving';
      let movementNote = '';
      if (totalConsumed === 0) {
        movementSpeed = 'non-moving';
        movementNote = currentRob > 0 ? 'No consumption recorded - consider stock reduction' : '';
      } else {
        const fastThreshold = daysOfData < 30 ? 0.5 : 2.0;
        const slowThreshold = daysOfData < 30 ? 0.05 : 0.5;
        if (stockTurnoverRatio >= fastThreshold || consumptionFrequency >= 0.5) {
          movementSpeed = 'fast';
          movementNote = totalConsumed >= minStock ? 'High consumption rate' : '';
        } else if (stockTurnoverRatio >= slowThreshold || consumptionFrequency >= 0.1) {
          movementSpeed = 'slow';
          movementNote = 'Monitor stock levels';
        } else {
          movementSpeed = 'very-slow';
          movementNote = 'Consider stock reduction';
        }
      }

      const avgDailyConsumption = daysOfData > 0 ? totalConsumed / daysOfData : 0;
      const baseStockoutDays = avgDailyConsumption > 0 ? currentRob / avgDailyConsumption : null;
      let daysUntilStockout = baseStockoutDays !== null ? Math.round(baseStockoutDays) : null;
      let stockoutRange: { lower: number; upper: number } | null = null;
      let stockoutConfidence: 'low' | 'medium' | 'high' = 'high';
      if (baseStockoutDays !== null && baseStockoutDays > 0) {
        if (daysOfData < 7) {
          stockoutRange = { lower: Math.floor(baseStockoutDays * 0.5), upper: Math.ceil(baseStockoutDays * 2.0) };
          stockoutConfidence = 'low';
        } else if (daysOfData < 30) {
          stockoutRange = { lower: Math.floor(baseStockoutDays * 0.75), upper: Math.ceil(baseStockoutDays * 1.5) };
          stockoutConfidence = 'medium';
        }
      }
      const belowMinStock = currentRob < minStock;
      const negativeRob = currentRob < 0;

      return {
        itemId,
        itemCode: item.itemCode || '',
        itemName: item.itemName || '',
        itemType: item.itemType || '',
        uom: item.uom || '',
        currentRob,
        minStock,
        avgRob: Math.round(avgRob * 100) / 100,
        totalConsumed: Math.round(totalConsumed * 100) / 100,
        stockTurnoverRatio,
        movementSpeed,
        movementNote,
        consumptionFrequency: Math.round(consumptionFrequency * 1000) / 1000,
        stockHealthRatio: stockHealthRatio !== null ? Math.round(stockHealthRatio * 100) / 100 : null,
        daysUntilStockout,
        stockoutRange,
        stockoutConfidence,
        belowMinStock,
        negativeRob,
        eventCount,
      };
    })
    .sort((a: any, b: any) => b.stockTurnoverRatio - a.stockTurnoverRatio);

  const forecastData = topConsumedItems.map(item => {
    const avgDaily = daysOfData > 0 ? item.totalConsumed / daysOfData : 0;
    let forecastConfidenceMultiplier = 1.0;
    if (daysOfData < 7) forecastConfidenceMultiplier = 0.5;
    else if (daysOfData < 30) forecastConfidenceMultiplier = 0.75;
    const adjustedDaily = avgDaily * forecastConfidenceMultiplier;
    const projectedMonthly = Math.round(adjustedDaily * 30 * 100) / 100;
    const monthsRemaining = adjustedDaily > 0 ? Math.round((item.currentRob / adjustedDaily / 30) * 10) / 10 : null;

    const leadTimeDays = 30;
    const safetyStock = projectedMonthly;
    const reorderPoint = Math.round((adjustedDaily * leadTimeDays + safetyStock) * 100) / 100;
    const targetLevel = Math.max(item.minStock * 3, projectedMonthly * 6);
    const reorderNeeded = item.currentRob <= reorderPoint && projectedMonthly > 0;
    const suggestedReorderQty = reorderNeeded ? Math.max(0, Math.ceil(targetLevel - item.currentRob)) : 0;
    const reorderReasoning = reorderNeeded
      ? `Bring stock from ${item.currentRob} to ${Math.round(targetLevel)} (${projectedMonthly > 0 ? Math.round(targetLevel / projectedMonthly * 10) / 10 : '\u221E'} months supply at ${projectedMonthly}/month)`
      : item.currentRob > reorderPoint ? 'Stock adequate - above reorder point' : 'No consumption recorded';

    return {
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      itemType: item.itemType,
      uom: item.uom,
      avgMonthlyConsumption: item.avgMonthlyConsumption,
      rawAvgMonthlyConsumption: item.rawAvgMonthlyConsumption,
      projectedNextMonth: projectedMonthly,
      currentRob: item.currentRob,
      minStock: item.minStock,
      monthsOfStockRemaining: monthsRemaining,
      reorderNeeded,
      suggestedReorderQty,
      reorderPoint,
      targetLevel: Math.round(targetLevel),
      safetyStock: Math.round(safetyStock * 100) / 100,
      leadTimeDays,
      reorderReasoning,
      confidenceLevel,
    };
  });

  const nonMovingItems = stockEfficiency
    .filter((i: any) => i.movementSpeed === 'non-moving' && i.currentRob > 0)
    .slice(0, 50);

  const recentTransactions = [...consumeEvents]
    .sort((a: any, b: any) => {
      const dateA = new Date(a.timestampUTC || a.dateLocal || 0).getTime();
      const dateB = new Date(b.timestampUTC || b.dateLocal || 0).getTime();
      return dateB - dateA;
    })
    .slice(0, 100)
    .map((h: any) => ({
      id: h.id,
      date: h.timestampUTC || h.dateLocal,
      itemId: h.itemId,
      itemCode: h.partCode,
      itemName: h.itemName,
      section: h.section,
      qtyConsumed: Math.abs(parseFloat(String(h.qtyChangeBase)) || 0),
      robAfter: parseFloat(String(h.robAfterBase)) || 0,
      uom: h.uom || '',
      userId: h.userId || '',
      remarks: h.remarks || '',
    }));

  const uniqueItemsConsumed = new Set(consumeEvents.map((h: any) => h.itemId)).size;

  return {
    summary: {
      totalItemsConsumed: uniqueItemsConsumed,
      totalQuantityConsumed: Math.round(consumeEvents.reduce((sum: number, h: any) => sum + Math.abs(parseFloat(String(h.qtyChangeBase)) || 0), 0) * 100) / 100,
      totalConsumptionEvents: consumeEvents.length,
      dateRange: { start: earliestDate.toISOString(), end: latestDate.toISOString() },
      dataQuality: {
        daysOfData,
        isLimitedData: daysOfData < 30,
        confidenceLevel,
        message: daysOfData < 30
          ? `Analysis based on ${daysOfData} days of consumption data. More accurate trends will develop over time.`
          : daysOfData < 90
            ? `Analysis based on ${daysOfData} days of data. Moderate confidence in trend projections.`
            : `Analysis based on ${daysOfData} days of data. High confidence in trend projections.`,
      },
      totalInventoryItems: allItems.filter((i: any) => !i.deleted && i.isActive !== false).length,
      dataMonths: Math.max(0.1, Math.round((daysOfData / 30) * 10) / 10),
      vesselName,
    },
    consumptionTrends,
    topConsumedItems,
    categoryBreakdown,
    stockEfficiency,
    forecastData,
    nonMovingItems,
    recentTransactions,
  };
}

// ═══════════════════════════════════════════════════════════════
// STORES CONSUMPTION ANALYSIS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportStoresConsumptionExcel(
  vesselId: string,
  startDate: string | undefined,
  endDate: string | undefined,
  itemType: string | undefined,
  category: string | undefined,
  componentFilter?: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const allVessels = await repo.getVessels();
  let allHistory: any[];
  let allItems: any[];
  if (vesselId === 'all') {
    allHistory = []; allItems = [];
    for (const vessel of allVessels) {
      allHistory = allHistory.concat(await repo.getStoresTransactionHistory(vessel.id));
      allItems = allItems.concat(await repo.getStoresItems(vessel.id));
    }
  } else {
    allHistory = await repo.getStoresTransactionHistory(vesselId);
    allItems = await repo.getStoresItems(vesselId);
  }
  const vessel = allVessels.find((v: any) => v.id === vesselId);
  const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);
  const itemsMap = new Map(allItems.map((item: any) => [item.id, item]));

  let consumeEvents = allHistory.filter((h: any) => h.eventType === 'CONSUME');
  if (startDate) {
    const sd = new Date(startDate);
    consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) >= sd);
  }
  if (endDate) {
    const ed = new Date(endDate);
    ed.setHours(23, 59, 59, 999);
    consumeEvents = consumeEvents.filter((h: any) => new Date(h.timestampUTC) <= ed);
  }
  if (itemType && itemType !== 'all') {
    consumeEvents = consumeEvents.filter((h: any) => h.section === itemType);
  }
  if (category && category !== 'all') {
    const catItemIds = new Set(allItems.filter((i: any) => i.category === category).map((i: any) => i.id));
    consumeEvents = consumeEvents.filter((h: any) => catItemIds.has(h.itemId));
  }

  if (componentFilter && componentFilter.trim()) {
    const cf = componentFilter.toLowerCase();
    const matchingItemIds = new Set(
      allItems.filter((i: any) =>
        (i.itemName || '').toLowerCase().includes(cf) ||
        (i.itemCode || '').toLowerCase().includes(cf) ||
        (i.componentName || '').toLowerCase().includes(cf)
      ).map((i: any) => i.id)
    );
    consumeEvents = consumeEvents.filter((h: any) => matchingItemIds.has(h.itemId));
  }

  const dates = consumeEvents.map((h: any) => new Date(h.timestampUTC)).filter((d: Date) => !isNaN(d.getTime()));
  const earliestDate = dates.length > 0 ? new Date(Math.min(...dates.map((d: Date) => d.getTime()))) : new Date();
  const latestDate = dates.length > 0 ? new Date(Math.max(...dates.map((d: Date) => d.getTime()))) : new Date();
  const daysOfData = Math.max(1, Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();

  const datePeriod = `${earliestDate.toISOString().slice(0, 10)} to ${latestDate.toISOString().slice(0, 10)}`;

  const uniqueItems = new Set(consumeEvents.map((h: any) => h.itemId)).size;
  const totalQty = consumeEvents.reduce((sum: number, h: any) => sum + Math.abs(parseFloat(String(h.qtyChangeBase)) || 0), 0);

  // Sheet 1: Monthly Trends
  const trendsSheet = workbook.addWorksheet('Monthly Trends');
  const monthlyMap: Record<string, { totalQty: number; eventCount: number; stores: number; lubricants: number; chemicals: number; others: number }> = {};
  for (const h of consumeEvents) {
    const d = new Date(h.timestampUTC);
    const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlyMap[mk]) monthlyMap[mk] = { totalQty: 0, eventCount: 0, stores: 0, lubricants: 0, chemicals: 0, others: 0 };
    const qty = Math.abs(parseFloat(String(h.qtyChangeBase)) || 0);
    monthlyMap[mk].totalQty += qty;
    monthlyMap[mk].eventCount += 1;
    const sec = h.section || 'stores';
    if (sec === 'stores') monthlyMap[mk].stores += qty;
    else if (sec === 'lubricants' || sec === 'lubes') monthlyMap[mk].lubricants += qty;
    else if (sec === 'chemicals') monthlyMap[mk].chemicals += qty;
    else monthlyMap[mk].others += qty;
  }
  const trendsCols: ColumnDef[] = [
    { key: 'month', header: 'Month', width: 14, type: 'text' },
    { key: 'totalQty', header: 'Total Qty', width: 14, type: 'number', align: 'center' },
    { key: 'events', header: 'Events', width: 12, type: 'number', align: 'center' },
    { key: 'stores', header: 'Stores', width: 14, type: 'number', align: 'center' },
    { key: 'lubricants', header: 'Lubricants', width: 14, type: 'number', align: 'center' },
    { key: 'chemicals', header: 'Chemicals', width: 14, type: 'number', align: 'center' },
    { key: 'others', header: 'Others', width: 14, type: 'number', align: 'center' },
  ];
  const trendsLastCol = getLastColumnLetter(trendsCols.length);
  applyStandardHeader(trendsSheet, 'MONTHLY CONSUMPTION TRENDS', `Data Period: ${datePeriod}`, vesselName, Object.keys(monthlyMap).length, trendsLastCol, datePeriod);
  applyStandardTableHeader(trendsSheet, trendsCols, 7);

  Object.entries(monthlyMap).sort(([a], [b]) => a.localeCompare(b)).forEach(([month, data], idx) => {
    const row = trendsSheet.addRow([month, Math.round(data.totalQty * 100) / 100, data.eventCount, Math.round(data.stores * 100) / 100, Math.round(data.lubricants * 100) / 100, Math.round(data.chemicals * 100) / 100, Math.round(data.others * 100) / 100]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      const colDef = trendsCols[colNum - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
    });
  });
  applyStandardPageSetup(trendsSheet, 7, trendsCols.length, 6, vesselName);

  // Sheet 3: Item Analysis
  const itemSheet = workbook.addWorksheet('Item Analysis');
  const itemGrouped: Record<number, { totalConsumed: number; events: number; lastConsumed: Date }> = {};
  for (const h of consumeEvents) {
    if (!itemGrouped[h.itemId]) itemGrouped[h.itemId] = { totalConsumed: 0, events: 0, lastConsumed: new Date(h.timestampUTC) };
    itemGrouped[h.itemId].totalConsumed += Math.abs(parseFloat(String(h.qtyChangeBase)) || 0);
    itemGrouped[h.itemId].events += 1;
    const ts = new Date(h.timestampUTC);
    if (ts > itemGrouped[h.itemId].lastConsumed) itemGrouped[h.itemId].lastConsumed = ts;
  }
  const itemRows = Object.entries(itemGrouped).map(([id, g]) => {
    const item = itemsMap.get(Number(id));
    const rawMonthlyRate = Math.round((g.totalConsumed / daysOfData) * 30 * 100) / 100;
    let confidenceMultiplier = 1.0;
    if (daysOfData < 7) confidenceMultiplier = 0.5;
    else if (daysOfData < 30) confidenceMultiplier = 0.75;
    const adjustedMonthly = Math.round(rawMonthlyRate * confidenceMultiplier * 100) / 100;
    return {
      itemCode: item?.itemCode || '', itemName: item?.itemName || '', itemType: item?.itemType || '',
      category: item?.category || '', uom: item?.uom || '',
      totalConsumed: Math.round(g.totalConsumed * 100) / 100, events: g.events,
      avgMonthly: adjustedMonthly,
      rawRate: rawMonthlyRate !== adjustedMonthly ? rawMonthlyRate : null,
      currentRob: parseFloat(String(item?.rob)) || 0, minStock: parseFloat(String(item?.min)) || 0,
      lastConsumed: g.lastConsumed.toISOString().slice(0, 10),
    };
  }).sort((a, b) => b.totalConsumed - a.totalConsumed);

  const itemCols: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
    { key: 'itemCode', header: 'Item Code', width: 16, type: 'text' },
    { key: 'itemName', header: 'Item Name', width: 32, type: 'text' },
    { key: 'itemType', header: 'Type', width: 14, type: 'text' },
    { key: 'category', header: 'Category', width: 18, type: 'text' },
    { key: 'uom', header: 'UOM', width: 10, type: 'text', align: 'center' },
    { key: 'totalConsumed', header: 'Total Consumed', width: 16, type: 'number', align: 'center' },
    { key: 'events', header: 'Events', width: 10, type: 'number', align: 'center' },
    { key: 'avgMonthly', header: 'Avg Monthly', width: 14, type: 'number', align: 'center' },
    { key: 'rawRate', header: 'Raw Rate', width: 12, type: 'text', align: 'center' },
    { key: 'currentRob', header: 'Current ROB', width: 14, type: 'number', align: 'center' },
    { key: 'minStock', header: 'Min Stock', width: 12, type: 'number', align: 'center' },
    { key: 'lastConsumed', header: 'Last Consumed', width: 14, type: 'text', align: 'center' },
  ];
  const itemLastCol = getLastColumnLetter(itemCols.length);
  applyStandardHeader(itemSheet, 'ITEM-WISE CONSUMPTION ANALYSIS', `Data Period: ${datePeriod} | ${itemRows.length} items consumed`, vesselName, itemRows.length, itemLastCol, datePeriod);
  applyStandardTableHeader(itemSheet, itemCols, 7);

  itemRows.forEach((item, idx) => {
    const row = itemSheet.addRow([idx + 1, item.itemCode, item.itemName, item.itemType, item.category, item.uom, item.totalConsumed, item.events, item.avgMonthly, item.rawRate != null ? item.rawRate : '-', item.currentRob, item.minStock, item.lastConsumed]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      const colDef = itemCols[colNum - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
    });
  });
  applyStandardPageSetup(itemSheet, 7, itemCols.length, 6, vesselName);

  // Sheet 4: Category Breakdown
  const catSheet = workbook.addWorksheet('Category Breakdown');
  const catMap: Record<string, { totalQty: number; items: Set<number>; itemType: string }> = {};
  for (const h of consumeEvents) {
    const item = itemsMap.get(h.itemId);
    const cat = item?.category || item?.itemType || 'Uncategorized';
    if (!catMap[cat]) catMap[cat] = { totalQty: 0, items: new Set(), itemType: item?.itemType || '' };
    catMap[cat].totalQty += Math.abs(parseFloat(String(h.qtyChangeBase)) || 0);
    catMap[cat].items.add(h.itemId);
  }
  const catTotal = Object.values(catMap).reduce((s, c) => s + c.totalQty, 0);
  const catRows = Object.entries(catMap).map(([cat, data]) => ({
    category: cat, itemType: data.itemType, totalQty: Math.round(data.totalQty * 100) / 100,
    itemCount: data.items.size, percentage: catTotal > 0 ? Math.round((data.totalQty / catTotal) * 10000) / 100 : 0,
  })).sort((a, b) => b.totalQty - a.totalQty);

  const catCols: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
    { key: 'category', header: 'Category', width: 28, type: 'text' },
    { key: 'itemType', header: 'Item Type', width: 16, type: 'text' },
    { key: 'totalQty', header: 'Total Consumed', width: 16, type: 'number', align: 'center' },
    { key: 'itemCount', header: 'Items', width: 10, type: 'number', align: 'center' },
    { key: 'percentage', header: '% Share', width: 12, type: 'number', align: 'center' },
  ];
  const catLastCol = getLastColumnLetter(catCols.length);
  applyStandardHeader(catSheet, 'CATEGORY-WISE CONSUMPTION BREAKDOWN', `Data Period: ${datePeriod}`, vesselName, catRows.length, catLastCol, datePeriod);
  applyStandardTableHeader(catSheet, catCols, 7);

  catRows.forEach((item, idx) => {
    const row = catSheet.addRow([idx + 1, item.category, item.itemType, item.totalQty, item.itemCount, item.percentage]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      const colDef = catCols[colNum - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
    });
  });
  applyStandardPageSetup(catSheet, 7, catCols.length, 6, vesselName);

  // Sheet 5: Stock Efficiency
  const effSheet = workbook.addWorksheet('Stock Efficiency');
  const effItems = allItems.filter((i: any) => !i.deleted && i.isActive !== false).map((item: any) => {
    const consumed = itemGrouped[item.id];
    const totalConsumed = consumed?.totalConsumed || 0;
    const currentRob = parseFloat(String(item.rob)) || 0;
    const minStock = parseFloat(String(item.min)) || 0;
    const avgDaily = daysOfData > 0 ? totalConsumed / daysOfData : 0;
    const events = consumed?.events || 0;
    const consumptionFrequency = daysOfData > 0 ? events / daysOfData : 0;
    const turnover = currentRob > 0 ? Math.round((totalConsumed / currentRob) * 100) / 100 : 0;
    let speed = 'Non-Moving';
    let movementNote = '';
    if (totalConsumed === 0) {
      speed = 'Non-Moving';
      movementNote = currentRob > 0 ? 'No consumption - consider reduction' : '';
    } else {
      const fastThreshold = daysOfData < 30 ? 0.5 : 2.0;
      const slowThreshold = daysOfData < 30 ? 0.05 : 0.5;
      if (turnover >= fastThreshold || consumptionFrequency >= 0.5) {
        speed = 'Fast';
        movementNote = totalConsumed >= minStock ? 'High consumption rate' : '';
      } else if (turnover >= slowThreshold || consumptionFrequency >= 0.1) {
        speed = 'Slow';
        movementNote = 'Monitor stock levels';
      } else {
        speed = 'Very Slow';
        movementNote = 'Consider stock reduction';
      }
    }
    const baseStockoutDays = avgDaily > 0 ? currentRob / avgDaily : null;
    const daysToStockoutVal = baseStockoutDays !== null ? Math.round(baseStockoutDays) : null;
    let stockoutRange = '-';
    if (baseStockoutDays !== null && baseStockoutDays > 0) {
      if (daysOfData < 7) stockoutRange = `${Math.floor(baseStockoutDays * 0.5)}-${Math.ceil(baseStockoutDays * 2.0)}d`;
      else if (daysOfData < 30) stockoutRange = `${Math.floor(baseStockoutDays * 0.75)}-${Math.ceil(baseStockoutDays * 1.5)}d`;
    }
    return {
      itemCode: item.itemCode || '', itemName: item.itemName || '', itemType: item.itemType || '',
      uom: item.uom || '', currentRob, minStock, totalConsumed: Math.round(totalConsumed * 100) / 100,
      turnover, speed, movementNote,
      daysToStockout: daysToStockoutVal !== null ? daysToStockoutVal : '\u221E',
      stockoutRange,
      belowMin: currentRob < minStock ? 'Yes' : 'No',
    };
  }).sort((a: any, b: any) => (b.turnover || 0) - (a.turnover || 0));

  const effCols: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
    { key: 'itemCode', header: 'Item Code', width: 16, type: 'text' },
    { key: 'itemName', header: 'Item Name', width: 32, type: 'text' },
    { key: 'itemType', header: 'Type', width: 14, type: 'text' },
    { key: 'currentRob', header: 'ROB', width: 12, type: 'number', align: 'center' },
    { key: 'minStock', header: 'Min', width: 10, type: 'number', align: 'center' },
    { key: 'totalConsumed', header: 'Consumed', width: 14, type: 'number', align: 'center' },
    { key: 'turnover', header: 'Turnover', width: 12, type: 'number', align: 'center' },
    { key: 'speed', header: 'Movement', width: 14, type: 'text', align: 'center' },
    { key: 'daysToStockout', header: 'Days to Stockout', width: 16, type: 'text', align: 'center' },
    { key: 'stockoutRange', header: 'Stockout Range', width: 14, type: 'text', align: 'center' },
    { key: 'belowMin', header: 'Below Min', width: 12, type: 'text', align: 'center' },
    { key: 'movementNote', header: 'Note', width: 24, type: 'text' },
  ];
  const effLastCol = getLastColumnLetter(effCols.length);
  applyStandardHeader(effSheet, 'STOCK EFFICIENCY ANALYSIS', `Data Period: ${datePeriod} | Movement thresholds adjusted for ${daysOfData}-day sample`, vesselName, effItems.length, effLastCol, datePeriod);
  applyStandardTableHeader(effSheet, effCols, 7);

  effItems.forEach((item: any, idx: number) => {
    const row = effSheet.addRow([idx + 1, item.itemCode, item.itemName, item.itemType, item.currentRob, item.minStock, item.totalConsumed, item.turnover, item.speed, item.daysToStockout, item.stockoutRange, item.belowMin, item.movementNote]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      const colDef = effCols[colNum - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
      if (colNum === 9 && item.speed === 'Fast') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.success } };
      }
      if (colNum === 9 && item.speed === 'Very Slow') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.warning } };
      }
      if (colNum === 12 && item.belowMin === 'Yes') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.danger } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgDanger } };
      }
    });
  });
  applyStandardPageSetup(effSheet, 7, effCols.length, 6, vesselName);

  // Sheet 6: Forecast
  const forecastSheet = workbook.addWorksheet('Forecast');
  const forecastItems = Object.entries(itemGrouped).map(([id, g]) => {
    const item = itemsMap.get(Number(id));
    const avgDaily = daysOfData > 0 ? g.totalConsumed / daysOfData : 0;
    let fcMultiplier = 1.0;
    if (daysOfData < 7) fcMultiplier = 0.5;
    else if (daysOfData < 30) fcMultiplier = 0.75;
    const adjustedDaily = avgDaily * fcMultiplier;
    const projMonthly = Math.round(adjustedDaily * 30 * 100) / 100;
    const rawMonthly = Math.round(avgDaily * 30 * 100) / 100;
    const currentRob = parseFloat(String(item?.rob)) || 0;
    const minStock = parseFloat(String(item?.min)) || 0;
    const monthsRem = adjustedDaily > 0 ? Math.round((currentRob / adjustedDaily / 30) * 10) / 10 : null;
    const leadTimeDays = 30;
    const safetyStock = projMonthly;
    const reorderPoint = Math.round((adjustedDaily * leadTimeDays + safetyStock) * 100) / 100;
    const targetLevel = Math.max(minStock * 3, projMonthly * 6);
    const reorder = currentRob <= reorderPoint && projMonthly > 0;
    const suggestedQty = reorder ? Math.max(0, Math.ceil(targetLevel - currentRob)) : 0;
    const reasoning = reorder
      ? `Stock ${currentRob} \u2192 ${Math.round(targetLevel)} (${projMonthly > 0 ? Math.round(targetLevel / projMonthly * 10) / 10 : '\u221E'}mo supply)`
      : currentRob > reorderPoint ? 'Stock adequate' : 'No consumption';
    return {
      itemCode: item?.itemCode || '', itemName: item?.itemName || '', uom: item?.uom || '',
      avgMonthly: projMonthly, rawRate: rawMonthly !== projMonthly ? rawMonthly : null,
      projNextMonth: projMonthly, currentRob, minStock, reorderPoint: Math.round(reorderPoint),
      monthsRemaining: monthsRem !== null ? monthsRem : '-',
      reorderNeeded: reorder ? 'Yes' : 'No', suggestedQty, reasoning,
      confidence: daysOfData > 90 ? 'High' : daysOfData >= 30 ? 'Medium' : 'Low',
    };
  }).sort((a, b) => (typeof b.monthsRemaining === 'number' ? b.monthsRemaining : 999) - (typeof a.monthsRemaining === 'number' ? a.monthsRemaining : 999));

  const fcCols: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
    { key: 'itemCode', header: 'Item Code', width: 16, type: 'text' },
    { key: 'itemName', header: 'Item Name', width: 32, type: 'text' },
    { key: 'uom', header: 'UOM', width: 10, type: 'text', align: 'center' },
    { key: 'avgMonthly', header: 'Avg Monthly', width: 14, type: 'number', align: 'center' },
    { key: 'rawRate', header: 'Raw Rate', width: 12, type: 'text', align: 'center' },
    { key: 'projNextMonth', header: 'Projected', width: 14, type: 'number', align: 'center' },
    { key: 'currentRob', header: 'ROB', width: 12, type: 'number', align: 'center' },
    { key: 'minStock', header: 'Min', width: 10, type: 'number', align: 'center' },
    { key: 'reorderPoint', header: 'Reorder Pt', width: 12, type: 'number', align: 'center' },
    { key: 'monthsRemaining', header: 'Months Left', width: 14, type: 'text', align: 'center' },
    { key: 'reorderNeeded', header: 'Reorder?', width: 12, type: 'text', align: 'center' },
    { key: 'suggestedQty', header: 'Suggested Qty', width: 14, type: 'number', align: 'center' },
    { key: 'reasoning', header: 'Reasoning', width: 36, type: 'text' },
    { key: 'confidence', header: 'Confidence', width: 14, type: 'text', align: 'center' },
  ];
  const fcLastCol = getLastColumnLetter(fcCols.length);
  applyStandardHeader(forecastSheet, 'CONSUMPTION FORECAST & REORDER PROJECTIONS', `Data Period: ${datePeriod} | Confidence: ${daysOfData > 90 ? 'High' : daysOfData >= 30 ? 'Medium' : 'Low'}`, vesselName, forecastItems.length, fcLastCol, datePeriod);
  applyStandardTableHeader(forecastSheet, fcCols, 7);

  forecastItems.forEach((item, idx) => {
    const row = forecastSheet.addRow([idx + 1, item.itemCode, item.itemName, item.uom, item.avgMonthly, item.rawRate != null ? item.rawRate : '-', item.projNextMonth, item.currentRob, item.minStock, item.reorderPoint, item.monthsRemaining, item.reorderNeeded, item.suggestedQty, item.reasoning, item.confidence]);
    row.height = 20;
    row.eachCell((cell, colNum) => {
      const colDef = fcCols[colNum - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } } };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };
      if (colNum === 12 && item.reorderNeeded === 'Yes') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.danger } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgDanger } };
      }
      if (colNum === 15 && item.confidence === 'Low') {
        cell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: COLORS.warning } };
      }
    });
  });
  applyStandardPageSetup(forecastSheet, 7, fcCols.length, 6, vesselName);

  const startStr = earliestDate.toISOString().slice(0, 10);
  const endStr = latestDate.toISOString().slice(0, 10);
  const shortVessel = vesselName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `Consumption_Pattern_Analysis_${shortVessel}_${startStr}_to_${endStr}_${timestamp}.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// COMBINED CONSUMPTION ANALYSIS - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getCombinedConsumptionAnalysis(vesselId: string) {
  let history: any[];
  let allSpares: any[];
  if (vesselId === 'all') {
    const allVessels = await repo.getVessels();
    history = []; allSpares = [];
    for (const vessel of allVessels) {
      history = history.concat(await repo.getSpareHistory(vessel.id));
      allSpares = allSpares.concat(await repo.getSpares(vessel.id));
    }
  } else {
    history = await repo.getSpareHistory(vesselId);
    allSpares = await repo.getSpares(vesselId);
  }

  const consumeEvents = history.filter((h: any) => h.eventType === 'CONSUME');

  const grouped: Record<number, { partCode: string; partName: string; componentName: string; totalConsumed: number; events: number; lastConsumed: Date }> = {};

  for (const h of consumeEvents) {
    const key = h.spareId;
    if (!grouped[key]) {
      grouped[key] = {
        partCode: h.partCode || '',
        partName: h.partName || '',
        componentName: h.componentName || '',
        totalConsumed: 0,
        events: 0,
        lastConsumed: new Date(h.timestampUTC),
      };
    }
    grouped[key].totalConsumed += Math.abs(h.qtyChange || 0);
    grouped[key].events += 1;
    const ts = new Date(h.timestampUTC);
    if (ts > grouped[key].lastConsumed) {
      grouped[key].lastConsumed = ts;
    }
  }

  const sparesMap = new Map(allSpares.map((s: any) => [s.id, s]));

  const items = Object.entries(grouped).map(([spareId, g]) => {
    const spare = sparesMap.get(Number(spareId));
    const rob = spare?.rob ?? 0;
    const minStock = spare?.min ?? 0;
    const crit = ((spare?.critical || spare?.criticality || '') as string).toLowerCase();
    const isCritical = crit === 'critical' || crit === 'yes';
    return {
      spareId: Number(spareId),
      partCode: g.partCode,
      partName: g.partName,
      componentName: g.componentName,
      totalConsumed: g.totalConsumed,
      consumptionEvents: g.events,
      currentRob: rob,
      minStock: minStock,
      status: isCritical ? 'Critical' : 'Normal',
      lastConsumed: g.lastConsumed.toISOString(),
    };
  });

  items.sort((a, b) => {
    if (b.totalConsumed !== a.totalConsumed) return b.totalConsumed - a.totalConsumed;
    return a.partCode.localeCompare(b.partCode);
  });

  return {
    summary: {
      totalItems: items.length,
      totalConsumed: items.reduce((sum, i) => sum + i.totalConsumed, 0),
      totalEvents: items.reduce((sum, i) => sum + i.consumptionEvents, 0),
      criticalItems: items.filter(i => i.status === 'Critical').length,
    },
    items,
  };
}

// ═══════════════════════════════════════════════════════════════
// COMBINED CONSUMPTION ANALYSIS - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportCombinedConsumptionExcel(vesselId: string): Promise<{ buffer: Buffer; filename: string }> {
  const allVessels = await repo.getVessels();
  let history: any[];
  let allSpares: any[];
  if (vesselId === 'all') {
    history = []; allSpares = [];
    for (const vessel of allVessels) {
      history = history.concat(await repo.getSpareHistory(vessel.id));
      allSpares = allSpares.concat(await repo.getSpares(vessel.id));
    }
  } else {
    history = await repo.getSpareHistory(vesselId);
    allSpares = await repo.getSpares(vesselId);
  }
  const vessel = allVessels.find((v: any) => v.id === vesselId);
  const vesselName = vesselId === 'all' ? 'All Vessels' : (vessel?.name || vesselId);

  const consumeEvents = history.filter((h: any) => h.eventType === 'CONSUME');

  const grouped: Record<number, { partCode: string; partName: string; componentName: string; totalConsumed: number; events: number; lastConsumed: Date }> = {};

  for (const h of consumeEvents) {
    const key = h.spareId;
    if (!grouped[key]) {
      grouped[key] = {
        partCode: h.partCode || '',
        partName: h.partName || '',
        componentName: h.componentName || '',
        totalConsumed: 0,
        events: 0,
        lastConsumed: new Date(h.timestampUTC),
      };
    }
    grouped[key].totalConsumed += Math.abs(h.qtyChange || 0);
    grouped[key].events += 1;
    const ts = new Date(h.timestampUTC);
    if (ts > grouped[key].lastConsumed) {
      grouped[key].lastConsumed = ts;
    }
  }

  const sparesMap = new Map(allSpares.map((s: any) => [s.id, s]));

  const items = Object.entries(grouped).map(([spareId, g]) => {
    const spare = sparesMap.get(Number(spareId));
    const rob = spare?.rob ?? 0;
    const minStock = spare?.min ?? 0;
    const crit = ((spare?.critical || spare?.criticality || '') as string).toLowerCase();
    const isCritical = crit === 'critical' || crit === 'yes';

    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const d = g.lastConsumed;
    const day = String(d.getUTCDate()).padStart(2, '0');
    const mon = months[d.getUTCMonth()];
    const yr = d.getUTCFullYear();
    const lastConsumedFormatted = `${day}-${mon}-${yr}`;

    return {
      partCode: g.partCode,
      partName: g.partName,
      componentName: g.componentName,
      totalConsumed: g.totalConsumed,
      consumptionEvents: g.events,
      currentRob: rob,
      minStock: minStock,
      status: isCritical ? 'Critical' : 'Normal',
      lastConsumed: lastConsumedFormatted,
    };
  });

  items.sort((a, b) => {
    if (b.totalConsumed !== a.totalConsumed) return b.totalConsumed - a.totalConsumed;
    return a.partCode.localeCompare(b.partCode);
  });

  const criticalCount = items.filter(i => i.status === 'Critical').length;
  const totalConsumed = items.reduce((sum, i) => sum + i.totalConsumed, 0);
  const totalEvents = items.reduce((sum, i) => sum + i.consumptionEvents, 0);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'PMS System';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('Consumption Analysis');

  const columns: ColumnDef[] = [
    { key: 'sno', header: 'S.No', width: 8, type: 'number', align: 'center' },
    { key: 'partCode', header: 'Part Code', width: 20, type: 'text' },
    { key: 'partName', header: 'Part Name', width: 32, type: 'text' },
    { key: 'componentName', header: 'Component', width: 28, type: 'text' },
    { key: 'totalConsumed', header: 'Total Consumed', width: 16, type: 'number', align: 'center' },
    { key: 'consumptionEvents', header: 'Consumption Events', width: 18, type: 'number', align: 'center' },
    { key: 'currentRob', header: 'Current ROB', width: 14, type: 'number', align: 'center' },
    { key: 'minStock', header: 'Min Stock', width: 12, type: 'number', align: 'center' },
    { key: 'status', header: 'Status', width: 14, type: 'text', align: 'center' },
    { key: 'lastConsumed', header: 'Last Consumed', width: 16, type: 'text', align: 'center' },
  ];

  const totalColumns = columns.length;
  const lastColLetter = getLastColumnLetter(totalColumns);

  const subtitle = `Total Items: ${items.length} | Total Consumed: ${totalConsumed} | Total Events: ${totalEvents} | Critical: ${criticalCount}`;
  applyStandardHeader(worksheet, 'CONSUMPTION PATTERN ANALYSIS', subtitle, vesselName, items.length, lastColLetter);

  const headerRowNum = 7;
  applyStandardTableHeader(worksheet, columns, headerRowNum);

  items.forEach((item, idx) => {
    const rowData: (string | number)[] = [
      idx + 1,
      item.partCode, item.partName, item.componentName,
      item.totalConsumed, item.consumptionEvents,
      item.currentRob, item.minStock, item.status, item.lastConsumed,
    ];
    const row = worksheet.addRow(rowData);
    row.height = 20;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colDef = columns[colNumber - 1];
      cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.textDark } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 === 0 ? COLORS.bgWhite : COLORS.bgLight } };
      cell.border = {
        bottom: { style: 'thin', color: { argb: COLORS.border } },
        right: { style: 'thin', color: { argb: COLORS.border } },
      };
      cell.alignment = { vertical: 'middle', horizontal: (colDef?.align as any) || 'left' };

      if (colNumber === 9 && item.status === 'Critical') {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.danger } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.bgDanger } };
      }
    });
  });

  worksheet.autoFilter = {
    from: { row: headerRowNum, column: 1 },
    to: { row: headerRowNum, column: totalColumns }
  };

  applyStandardPageSetup(worksheet, headerRowNum, totalColumns, 6, vesselName);

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = generateFilename('ConsumptionAnalysis', vesselName);

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}

// ═══════════════════════════════════════════════════════════════
// CHEMICALS EXPIRY REPORT
// ═══════════════════════════════════════════════════════════════

export async function getChemicalsExpiry(
  vesselId: string,
  expired: string | undefined,
  expiring_soon: string | undefined,
  hazard_class: string | undefined,
  stock_status: string | undefined,
) {
  let chemicals: any[];
  if (vesselId === 'all') {
    chemicals = [];
    const allVessels = await repo.getVessels();
    for (const v of allVessels) {
      const vChemicals = await repo.getStoresItemsFiltered(v.id, 'chemicals');
      chemicals.push(...vChemicals);
    }
  } else {
    chemicals = await repo.getStoresItemsFiltered(vesselId, 'chemicals');
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const enriched = chemicals.map((item: any) => {
    const expiryParsed = parseDate(item.expiryDate);
    let daysUntilExpiry: number | null = null;
    let expiryStatus = 'No Date';

    if (expiryParsed) {
      daysUntilExpiry = Math.floor((expiryParsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 0) expiryStatus = 'Expired';
      else if (daysUntilExpiry <= 30) expiryStatus = 'Critical';
      else if (daysUntilExpiry <= 60) expiryStatus = 'High';
      else if (daysUntilExpiry <= 90) expiryStatus = 'Medium';
      else expiryStatus = 'OK';
    }

    const rob = parseFloat(String(item.rob)) || 0;
    const min = parseFloat(String(item.min)) || 0;
    const stockStatus = rob === 0 ? 'Critical' : rob <= min ? 'Low' : 'OK';
    const hasSds = !!(item.sdsReference && item.sdsReference.trim());

    return {
      ...item,
      daysUntilExpiry,
      expiryStatus,
      stockStatus,
      hasSds,
    };
  });

  let filtered = enriched;

  if (expired === 'true') {
    filtered = filtered.filter((i: any) => i.expiryStatus === 'Expired');
  }

  if (expiring_soon) {
    const days = parseInt(expiring_soon);
    if (!isNaN(days)) {
      filtered = filtered.filter((i: any) => i.daysUntilExpiry !== null && i.daysUntilExpiry >= 0 && i.daysUntilExpiry <= days);
    }
  }

  if (hazard_class && hazard_class !== 'all') {
    filtered = filtered.filter((i: any) => i.hazardClassification === hazard_class);
  }

  if (stock_status && stock_status !== 'all') {
    filtered = filtered.filter((i: any) => i.stockStatus === stock_status);
  }

  const totalChemicals = enriched.length;
  const expiredCount = enriched.filter((i: any) => i.expiryStatus === 'Expired').length;
  const expiringSoonCount = enriched.filter((i: any) => ['Critical', 'High', 'Medium'].includes(i.expiryStatus)).length;
  const withSds = enriched.filter((i: any) => i.hasSds).length;
  const sdsCompliancePercent = totalChemicals > 0 ? Math.round((withSds / totalChemicals) * 100) : 0;

  return {
    items: filtered,
    summary: {
      totalChemicals,
      expiredCount,
      expiringSoonCount,
      sdsCompliancePercent,
      withSds,
      withoutSds: totalChemicals - withSds,
      lowStockCount: enriched.filter((i: any) => i.stockStatus === 'Low' || i.stockStatus === 'Critical').length,
    }
  };
}

// ═══════════════════════════════════════════════════════════════
// STORES LOW STOCK ALERT - PREVIEW
// ═══════════════════════════════════════════════════════════════

export async function getStoresLowStockAlert(
  vesselId: string,
  filters: { category?: string; priority?: string; location?: string },
  vesselIds?: string[],
) {
  let result: any;
  if (vesselId === 'all') {
    const allVessels = await repo.getVessels();
    const vessels = vesselIds?.length ? allVessels.filter((v: any) => vesselIds.includes(v.id)) : allVessels;
    let mergedItems: any[] = [];
    let mergedSummary: any = { totalItems: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, totalDeficit: 0, estimatedCost: 0 };
    for (const vessel of vessels) {
      const vesselResult = await lowStockReportService.computeReport(vessel.id, filters);
      const taggedItems = (vesselResult.items || []).map((item: any) => ({ ...item, vesselName: vessel.name || vessel.id }));
      mergedItems = mergedItems.concat(taggedItems);
      if (vesselResult.summary) {
        mergedSummary.totalItems += (vesselResult.summary as any).totalItems || 0;
        mergedSummary.criticalCount += (vesselResult.summary as any).criticalCount || 0;
        mergedSummary.highCount += (vesselResult.summary as any).highCount || 0;
        mergedSummary.mediumCount += (vesselResult.summary as any).mediumCount || 0;
        mergedSummary.lowCount += (vesselResult.summary as any).lowCount || 0;
        mergedSummary.totalDeficit += (vesselResult.summary as any).totalDeficit || 0;
        mergedSummary.estimatedCost += (vesselResult.summary as any).estimatedCost || 0;
      }
    }
    result = { summary: mergedSummary, items: mergedItems };
  } else {
    result = await lowStockReportService.computeReport(vesselId, filters);
  }

  lowStockReportService.saveSnapshot(
    vesselId, 'low-stock-alert', 'json', result.summary, result.items, filters
  ).catch(err => console.error("Snapshot save error:", err));

  return { summary: result.summary, items: result.items };
}

// ═══════════════════════════════════════════════════════════════
// STORES LOW STOCK ALERT - EXCEL EXPORT
// ═══════════════════════════════════════════════════════════════

export async function exportStoresLowStockAlertExcel(vesselId: string, componentFilter?: string): Promise<{ buffer: Buffer; filename: string }> {
  let result: any;
  if (vesselId === 'all') {
    const allVessels = await repo.getVessels();
    let mergedItems: any[] = [];
    let mergedSummary: any = { totalItems: 0, criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, totalDeficit: 0, estimatedCost: 0 };
    for (const vessel of allVessels) {
      const vesselResult = await lowStockReportService.computeReport(vessel.id);
      mergedItems = mergedItems.concat(vesselResult.items);
      if (vesselResult.summary) {
        mergedSummary.totalItems += (vesselResult.summary as any).totalItems || 0;
        mergedSummary.criticalCount += (vesselResult.summary as any).criticalCount || 0;
        mergedSummary.highCount += (vesselResult.summary as any).highCount || 0;
        mergedSummary.mediumCount += (vesselResult.summary as any).mediumCount || 0;
        mergedSummary.lowCount += (vesselResult.summary as any).lowCount || 0;
        mergedSummary.totalDeficit += (vesselResult.summary as any).totalDeficit || 0;
        mergedSummary.estimatedCost += (vesselResult.summary as any).estimatedCost || 0;
      }
    }
    result = { summary: mergedSummary, items: mergedItems };
  } else {
    result = await lowStockReportService.computeReport(vesselId);
  }
  let lowStockItems = result.items;

  if (componentFilter && componentFilter.trim()) {
    const cf = componentFilter.toLowerCase();
    lowStockItems = lowStockItems.filter((i: any) =>
      (i.itemName || '').toLowerCase().includes(cf) ||
      (i.itemCode || '').toLowerCase().includes(cf) ||
      (i.componentName || '').toLowerCase().includes(cf)
    );
  }

  lowStockReportService.saveSnapshot(
    vesselId, 'low-stock-alert', 'excel', result.summary, lowStockItems
  ).catch(err => console.error("Snapshot save error:", err));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Low Stock Alert');

  const headerRow = sheet.addRow([
    'S.No', 'Item Code', 'Item Name', 'Type', 'Category',
    'ROB', 'Min Stock', 'Deficit', 'UOM',
    'Avg Monthly', 'Days to Stockout', 'Est. Cost'
  ]);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.columns = [
    { width: 6 }, { width: 14 }, { width: 30 }, { width: 12 }, { width: 16 },
    { width: 8 }, { width: 10 }, { width: 8 }, { width: 8 },
    { width: 16 }, { width: 18 }, { width: 14 }
  ];

  const priorityColors: Record<string, string> = {
    Critical: 'FFFEE2E2',
    High: 'FFFFF7ED',
    Medium: 'FFFFFBEB',
  };

  lowStockItems.forEach((item: any, idx: number) => {
    const row = sheet.addRow([
      idx + 1, item.itemCode, item.itemName, item.itemType, item.category,
      item.rob, item.minStock, item.deficit, item.uom || '-',
      item.avgMonthlyConsumption, item.daysUntilStockout ?? 'N/A', item.estimatedCost !== null ? `$${item.estimatedCost}` : 'N/A'
    ]);
    const bgColor = priorityColors[item.priority] || 'FFFFFFFF';
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    row.alignment = { vertical: 'middle' };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = 'low-stock-alert-report.xlsx';

  return { buffer: Buffer.from(buffer as ArrayBuffer), filename };
}
