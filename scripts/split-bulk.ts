/**
 * Script to split server/routes/bulk.ts (7,620 lines) into modular files.
 * Extracts line ranges and writes to target files with proper import/export headers.
 *
 * This is a one-time migration script — delete after use.
 */
import * as fs from 'fs';
import * as path from 'path';

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKTREE = path.resolve(__dirname, '..');
const SOURCE = path.join(WORKTREE, 'server/routes/bulk.ts');
const MODULE_DIR = path.join(WORKTREE, 'server/modules/bulk-upload');

const lines = fs.readFileSync(SOURCE, 'utf-8').split('\n');

function extractLines(start: number, end: number): string {
  // Lines are 1-indexed in the file, 0-indexed in array
  return lines.slice(start - 1, end).join('\n');
}

function addExportToFunctions(code: string): string {
  // Add 'export' to standalone function declarations that don't already have it
  return code.replace(/^(async )?function /gm, 'export $1function ');
}

function writeFile(relPath: string, content: string) {
  const fullPath = path.join(MODULE_DIR, relPath);
  const dir = path.dirname(fullPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf-8');
  console.log(`  ✅ ${relPath} (${content.split('\n').length} lines)`);
}

console.log(`📋 Source file: ${lines.length} lines`);
console.log(`📂 Target: ${MODULE_DIR}\n`);

// ═══════════════════════════════════════════════════════════
// 1. services/dryRunCache.ts — In-memory cache
// ═══════════════════════════════════════════════════════════
writeFile('services/dryRunCache.ts', `// In-memory dry-run results cache
// In production, consider Redis or similar
export const dryRunCache = new Map<string, any>();

export function cleanExpiredCache(maxAgeMs = 3600000) {
  const cutoff = Date.now() - maxAgeMs;
  Array.from(dryRunCache.entries()).forEach(([key, value]) => {
    if (value.timestamp < cutoff) {
      dryRunCache.delete(key);
    }
  });
}
`);

// ═══════════════════════════════════════════════════════════
// 2. services/helpers.ts — Constants + utility functions
// ═══════════════════════════════════════════════════════════
{
  const header = `import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

`;
  // Lines 26-28: TEMPLATE_VERSION constants
  const constants = extractLines(26, 28);
  // Lines 30-92: checkTemplateVersion, addVersionInfoToSheet, getColumnLetter
  const helperFns1 = extractLines(30, 92);
  // Lines 231-603: extractRawExcelData
  const extractFn = extractLines(227, 603);
  // Lines 604-632: getExplicitParentFromRowEarly
  const earlyParent = extractLines(604, 632);
  // Lines 633-692: normalizeColumnNames
  const normalize = extractLines(633, 692);
  // Lines 693-829: SFI helpers + constants
  const sfiHelpers = extractLines(693, 829);
  // Lines 2462-2479: getTypeFromSheetName
  const sheetType = extractLines(2460, 2479);

  const body = [constants, helperFns1, extractFn, earlyParent, normalize, sfiHelpers, sheetType].join('\n\n');
  writeFile('services/helpers.ts', header + addExportToFunctions(body) + '\n');
}

// ═══════════════════════════════════════════════════════════
// 3. services/templateService.ts — Template generation
// ═══════════════════════════════════════════════════════════
{
  const header = `import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { TEMPLATE_VERSION, TEMPLATE_VERSION_DATE, TEMPLATE_VERSION_CELL, addVersionInfoToSheet, getColumnLetter } from './helpers';
import { getSparesExcelColumns } from '../../../shared/sparesTemplateFields';

`;
  const body = extractLines(830, 1877);
  writeFile('services/templateService.ts', header + addExportToFunctions(body) + '\n');
}

// ═══════════════════════════════════════════════════════════
// 4. services/validationService.ts — validateData function
// ═══════════════════════════════════════════════════════════
{
  const header = `import { storage } from '../../../storage';
import { getSFIName } from '../../../utils/sfiLookup';
import {
  normalizeColumnNames,
  getComponentCategory,
  getSubGroupCode,
  getSubGroupName,
  stripSFISuffix,
  getParentSFICode,
  validateSFICode,
  getExplicitParentFromRow,
  getExplicitParentFromRowEarly,
  UOM_LIST,
  STORES_CATEGORIES,
  DEPARTMENTS,
  RESPONSIBLE_RANKS,
  SCHEDULE_TYPES,
  INTERVAL_UNITS
} from './helpers';
import { calculateNextDueDate, normalizeDateToDDMMMYYYY } from '../../../shared/dateUtils';

`;
  const body = extractLines(2850, 4280);
  writeFile('services/validationService.ts', header + addExportToFunctions(body) + '\n');
}

// ═══════════════════════════════════════════════════════════
// 5. services/undoService.ts — createRecordSnapshot
// ═══════════════════════════════════════════════════════════
{
  const header = `import { calculateRecordChecksum, sortObjectKeys } from '../../../storage';

`;
  const body = extractLines(4282, 4303);
  writeFile('services/undoService.ts', header + addExportToFunctions(body) + '\n');
}

// ═══════════════════════════════════════════════════════════
// 6. services/importService.ts — performImport function
// ═══════════════════════════════════════════════════════════
{
  const header = `import { storage } from '../../../storage';
import { v4 as uuidv4 } from 'uuid';
import { getSFIName } from '../../../utils/sfiLookup';
import { calculateNextDueDate, normalizeDateToDDMMMYYYY } from '../../../shared/dateUtils';
import { generatePlannedWorkOrderNumber, generateUnplannedWorkOrderNumber } from '../../../utils/workOrderNumbering';
import {
  getComponentCategory,
  getSubGroupCode,
  getSubGroupName,
  stripSFISuffix,
  getParentSFICode,
  getExplicitParentFromRow,
  UOM_LIST,
  STORES_CATEGORIES,
  DEPARTMENTS,
  RESPONSIBLE_RANKS
} from './helpers';
import { createRecordSnapshot } from './undoService';

`;
  const body = extractLines(4304, 6698);
  writeFile('services/importService.ts', header + addExportToFunctions(body) + '\n');
}

// ═══════════════════════════════════════════════════════════
// 7. services/historyService.ts — History helper functions
// ═══════════════════════════════════════════════════════════
{
  const header = `import {
  getImportHistoryList,
  getImportHistoryById as getFileBasedHistoryById
} from '../../../services/fileBasedImportHistory';

`;
  const body = extractLines(6701, 6734);
  writeFile('services/historyService.ts', header + addExportToFunctions(body) + '\n');
}

// ═══════════════════════════════════════════════════════════
// 8. controllers/bulkController.ts — HTTP handlers
// ═══════════════════════════════════════════════════════════
{
  const header = `import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { storage, calculateRecordChecksum, sortObjectKeys } from '../../../storage';
import { ObjectStorageService, ObjectNotFoundError } from '../../../objectStorage';
import {
  saveImportHistory,
  getImportHistoryById as getFileBasedHistoryById,
  updateImportHistory as updateFileBasedHistory
} from '../../../services/fileBasedImportHistory';
import { dryRunCache, cleanExpiredCache } from '../services/dryRunCache';
import {
  checkTemplateVersion,
  extractRawExcelData,
  normalizeColumnNames,
  getTypeFromSheetName,
  TEMPLATE_VERSION
} from '../services/helpers';
import { generateFleetMasterTemplate } from '../services/templateService';
import { validateData } from '../services/validationService';
import { performImport } from '../services/importService';
import { getImportHistory, getHistoryFile } from '../services/historyService';
import { createRecordSnapshot } from '../services/undoService';
import { getSparesExcelColumns } from '../../../../shared/sparesTemplateFields';

`;

  // Build controller from route handlers
  // GET /template (lines 1880-2433)
  const templateHandler = extractLines(1880, 2433)
    .replace('router.get(\'/template\', async (req, res) => {', 'export async function getTemplate(req: Request, res: Response) {')
    .replace(/^\}\);$/m, '}');

  // POST /sheets (lines 2436-2459)
  const sheetsHandler = extractLines(2436, 2459)
    .replace('router.post(\'/sheets\', upload.single(\'file\'), async (req, res) => {', 'export async function getSheets(req: Request, res: Response) {')
    .replace(/^\}\);$/m, '}');

  // POST /dry-run (lines 2481-2599)
  const dryRunHandler = extractLines(2481, 2599)
    .replace('router.post(\'/dry-run\', upload.single(\'file\'), async (req, res) => {', 'export async function dryRun(req: Request, res: Response) {')
    .replace(/^\}\);$/m, '}');

  // POST /import (lines 2602-2749)
  const importHandler = extractLines(2602, 2749)
    .replace('router.post(\'/import\', async (req, res) => {', 'export async function doImport(req: Request, res: Response) {')
    .replace(/^\}\);$/m, '}');

  // GET /history (lines 2752-2767)
  const historyHandler = extractLines(2752, 2767)
    .replace('router.get(\'/history\', async (req, res) => {', 'export async function getHistoryList(req: Request, res: Response) {')
    .replace(/^\}\);$/m, '}');

  // GET /history/:id/download-original (lines 2771-2830)
  const downloadHandler = extractLines(2771, 2830)
    .replace('router.get(\'/history/:id/download-original\', async (req, res) => {', 'export async function downloadOriginal(req: Request, res: Response) {')
    .replace(/^\}\);$/m, '}');

  // GET /history/:id/:fileType (lines 2831-2847)
  const fileTypeHandler = extractLines(2831, 2847)
    .replace('router.get(\'/history/:id/:fileType\', async (req, res) => {', 'export async function getHistoryFileHandler(req: Request, res: Response) {')
    .replace(/^\}\);$/m, '}');

  // POST /undo/:historyId (lines 6737-7040)
  const undoHandler = extractLines(6737, 7040)
    .replace('router.post(\'/undo/:historyId\', async (req, res) => {', 'export async function undoImport(req: Request, res: Response) {')
    .replace(/^\}\);$/m, '}');

  // Makers CRUD (lines 7042-7293)
  const makersCrud = extractLines(7042, 7293);

  // SFI Details CRUD (lines 7293-7464)
  const sfiCrud = extractLines(7293, 7464);

  // Locations CRUD (lines 7464-7620)
  const locationsCrud = extractLines(7464, 7620);

  // Convert remaining router handlers to exported functions
  function convertRouterHandlers(code: string): string {
    return code
      .replace(/router\.(get|post|put|patch|delete)\('([^']+)',\s*(?:upload\.single\('[^']+'\),\s*)?async \(req, res\) => \{/g,
        (match, method, path) => {
          // Generate function name from method + path
          const fnName = path
            .replace(/^\//, '')
            .replace(/\/:(\w+)/g, 'By$1')
            .replace(/[/-]/g, '_')
            .replace(/__+/g, '_');
          return `export async function ${method}_${fnName}(req: Request, res: Response) {`;
        })
      .replace(/^\}\);$/gm, '}');
  }

  const makersFns = convertRouterHandlers(makersCrud);
  const sfiFns = convertRouterHandlers(sfiCrud);
  const locationsFns = convertRouterHandlers(locationsCrud);

  const controllerBody = [
    '// ── Template ──',
    templateHandler,
    '\n// ── Sheets ──',
    sheetsHandler,
    '\n// ── Dry Run ──',
    dryRunHandler,
    '\n// ── Import ──',
    importHandler,
    '\n// ── History ──',
    historyHandler,
    '\n// ── Download Original ──',
    downloadHandler,
    '\n// ── History File ──',
    fileTypeHandler,
    '\n// ── Undo ──',
    undoHandler,
    '\n// ═══════════════════════════════════════════════',
    '// MAKER LIST CRUD',
    '// ═══════════════════════════════════════════════',
    makersFns,
    '\n// ═══════════════════════════════════════════════',
    '// SFI DETAILS CRUD',
    '// ═══════════════════════════════════════════════',
    sfiFns,
    '\n// ═══════════════════════════════════════════════',
    '// LOCATIONS CRUD',
    '// ═══════════════════════════════════════════════',
    locationsFns
  ].join('\n');

  writeFile('controllers/bulkController.ts', header + controllerBody + '\n');
}

// ═══════════════════════════════════════════════════════════
// 9. routes.ts — Route definitions
// ═══════════════════════════════════════════════════════════
writeFile('routes.ts', `import { Router } from 'express';
import multer from 'multer';
import { asyncHandler } from '../shared/middleware';
import * as ctrl from './controllers/bulkController';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
});

// ══════════════════════════════════════════════════════════
// Bulk Upload Routes (/bulk/*)
// IMPORTANT: Specific paths MUST come before parameterized catch-alls
// ══════════════════════════════════════════════════════════

// ── Templates & Sheets ──
router.get('/bulk/template', asyncHandler(ctrl.getTemplate));
router.post('/bulk/sheets', upload.single('file'), asyncHandler(ctrl.getSheets));

// ── Dry-Run & Import ──
router.post('/bulk/dry-run', upload.single('file'), asyncHandler(ctrl.dryRun));
router.post('/bulk/import', asyncHandler(ctrl.doImport));

// ── History (specific routes before parameterized) ──
router.get('/bulk/history', asyncHandler(ctrl.getHistoryList));
router.get('/bulk/history/:id/download-original', asyncHandler(ctrl.downloadOriginal));
router.get('/bulk/history/:id/:fileType', asyncHandler(ctrl.getHistoryFileHandler));

// ── Undo ──
router.post('/bulk/undo/:historyId', asyncHandler(ctrl.undoImport));

// ── Makers CRUD ──
router.get('/bulk/makers/export', asyncHandler(ctrl.get_makers_export));
router.get('/bulk/makers', asyncHandler(ctrl.get_makers));
router.get('/bulk/makers/:id', asyncHandler(ctrl.get_makersByid));
router.post('/bulk/makers', asyncHandler(ctrl.post_makers));
router.patch('/bulk/makers/:id', asyncHandler(ctrl.patch_makersByid));
router.delete('/bulk/makers/:id', asyncHandler(ctrl.delete_makersByid));
router.post('/bulk/makers/import', upload.single('file'), asyncHandler(ctrl.post_makers_import));

// ── SFI Details CRUD ──
router.get('/bulk/sfi-details', asyncHandler(ctrl.get_sfi_details));
router.get('/bulk/sfi-details/:id', asyncHandler(ctrl.get_sfi_detailsByid));
router.post('/bulk/sfi-details', asyncHandler(ctrl.post_sfi_details));
router.patch('/bulk/sfi-details/:id', asyncHandler(ctrl.patch_sfi_detailsByid));
router.delete('/bulk/sfi-details/:id', asyncHandler(ctrl.delete_sfi_detailsByid));
router.post('/bulk/sfi-details/import', upload.single('file'), asyncHandler(ctrl.post_sfi_details_import));

// ── Locations ──
router.get('/bulk/locations/template', asyncHandler(ctrl.get_locations_template));
router.post('/bulk/locations/import', upload.single('file'), asyncHandler(ctrl.post_locations_import));
router.get('/bulk/locations', asyncHandler(ctrl.get_locations));
router.put('/bulk/locations/:id', asyncHandler(ctrl.put_locationsByid));
router.delete('/bulk/locations/:id', asyncHandler(ctrl.delete_locationsByid));

export default router;
`);

console.log('\n✅ All files created. Run tsc --noEmit to check for errors.');
