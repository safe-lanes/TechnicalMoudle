export interface RowValidationResult {
  row: number;
  status: 'ok' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
  normalized: Record<string, any>;
  original: Record<string, any>;
}

export interface DryRunSummary {
  ok: number;
  warnings: number;
  errors: number;
  total: number;
}

export interface DryRunResults {
  columns: string[];
  summary: DryRunSummary;
  rows: RowValidationResult[];
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  archived: number;
  jobComponentLinksCreated?: number;
  spareComponentLinksCreated?: number;
}

export interface BulkImportStrategy {
  type: string;
  primaryField: string;

  columnAliases: Record<string, string>;

  getTemplateHeaders(): string[];

  validate(
    row: Record<string, any>,
    rowNum: number,
    vesselId: string | undefined,
    context: StrategyContext
  ): Promise<{ errors: string[]; warnings: string[]; normalized: Record<string, any> }>;

  performImport(
    data: any[],
    mode: string,
    archiveMissing: boolean,
    vesselId: string | undefined,
    userId: string,
    importHistoryId: string,
    context: StrategyContext
  ): Promise<ImportResult>;
}

export interface StrategyContext {
  db: any;
  objectStorage?: any;
  [key: string]: any;
}

export interface CachedDryRunData {
  data: any[];
  normalizedData: any[];
  results: DryRunResults;
  type: string;
  file: Buffer;
  originalName: string;
  createdAt: number;
}
