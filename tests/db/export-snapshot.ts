#!/usr/bin/env tsx
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';
import { 
  components,
  workOrders,
  spares,
  sparesHistory,
  storesLedger,
  runningHoursAudit,
  changeRequest,
  changeRequestAttachment,
  changeRequestComment,
  alertPolicies,
  alertEvents,
  alertDeliveries,
  alertConfig,
  formDefinitions,
  formVersions,
  formVersionUsage,
  ihmItems,
  ihmMaintenanceLog
} from '../../shared/schema';
import { sql } from 'drizzle-orm';

interface ExportOptions {
  format: 'json' | 'csv' | 'sql';
  includeSampleData: boolean;
  sampleSize: number;
  outputDir: string;
  includeRowCounts: boolean;
  includeSchemaInfo: boolean;
}

interface TableExport {
  tableName: string;
  rowCount: number;
  sampleData?: any[];
  schemaInfo?: any;
  exportTime: string;
}

interface SnapshotMetadata {
  exportTime: string;
  databaseUrl: string;
  totalTables: number;
  totalRows: number;
  exportOptions: ExportOptions;
  tables: TableExport[];
}

export class DatabaseSnapshot {
  private db: any;
  private client: any;
  private tables: Array<{ name: string; table: any }> = [];

  constructor(connectionString?: string) {
    const dbUrl = connectionString || process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }
    this.client = postgres(dbUrl);
    this.db = drizzle(this.client);
    this.initializeTables();
  }

  private initializeTables() {
    this.tables = [
      { name: 'components', table: components },
      { name: 'work_orders', table: workOrders },
      { name: 'running_hours_audit', table: runningHoursAudit },
      { name: 'spares', table: spares },
      { name: 'spares_history', table: sparesHistory },
      { name: 'stores_ledger', table: storesLedger },
      { name: 'change_request', table: changeRequest },
      { name: 'change_request_attachment', table: changeRequestAttachment },
      { name: 'change_request_comment', table: changeRequestComment },
      { name: 'alert_policies', table: alertPolicies },
      { name: 'alert_events', table: alertEvents },
      { name: 'alert_deliveries', table: alertDeliveries },
      { name: 'alert_config', table: alertConfig },
      { name: 'form_definitions', table: formDefinitions },
      { name: 'form_versions', table: formVersions },
      { name: 'form_version_usage', table: formVersionUsage },
      { name: 'ihm_items', table: ihmItems },
      { name: 'ihm_maintenance_log', table: ihmMaintenanceLog }
    ];
  }

  async close(): Promise<void> {
    await this.client.end();
  }

  private async getTableRowCount(table: any): Promise<number> {
    try {
      const result = await this.db.select({ count: sql<number>`count(*)` }).from(table);
      return result[0]?.count || 0;
    } catch (error) {
      console.error(`Error counting rows:`, error);
      return -1;
    }
  }

  private async getSampleData(table: any, limit: number): Promise<any[]> {
    try {
      return await this.db.select().from(table).limit(limit);
    } catch (error) {
      console.error(`Error getting sample data:`, error);
      return [];
    }
  }

  private async getTableSchemaInfo(tableName: string): Promise<any> {
    try {
      const result = await this.db.execute(sql`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position
      `);
      return result;
    } catch (error) {
      console.error(`Error getting schema info for ${tableName}:`, error);
      return null;
    }
  }

  private formatAsCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvHeaders = headers.join(',');
    
    const csvRows = data.map(row => {
      return headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });
    
    return `${csvHeaders}\n${csvRows.join('\n')}`;
  }

  private formatAsSQL(tableName: string, data: any[]): string {
    if (data.length === 0) return `-- No data for table ${tableName}\n`;
    
    const sqlStatements: string[] = [];
    sqlStatements.push(`-- Data for table: ${tableName}`);
    sqlStatements.push(`-- Exported at: ${new Date().toISOString()}`);
    sqlStatements.push('');
    
    for (const row of data) {
      const columns = Object.keys(row).filter(k => row[k] !== undefined);
      const values = columns.map(col => {
        const value = row[col];
        if (value === null) return 'NULL';
        if (typeof value === 'number') return value;
        if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
        if (value instanceof Date) return `'${value.toISOString()}'`;
        if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::json`;
        return `'${String(value).replace(/'/g, "''")}'`;
      });
      
      sqlStatements.push(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
    }
    
    return sqlStatements.join('\n');
  }

  async exportSnapshot(options: Partial<ExportOptions> = {}): Promise<SnapshotMetadata> {
    const defaultOptions: ExportOptions = {
      format: 'json',
      includeSampleData: true,
      sampleSize: 100,
      outputDir: './exports',
      includeRowCounts: true,
      includeSchemaInfo: false
    };
    
    const opts = { ...defaultOptions, ...options };
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(opts.outputDir)) {
      fs.mkdirSync(opts.outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportDir = path.join(opts.outputDir, `db-snapshot-${timestamp}`);
    fs.mkdirSync(exportDir, { recursive: true });
    
    const metadata: SnapshotMetadata = {
      exportTime: new Date().toISOString(),
      databaseUrl: process.env.DATABASE_URL ? '***REDACTED***' : 'N/A',
      totalTables: this.tables.length,
      totalRows: 0,
      exportOptions: opts,
      tables: []
    };
    
    console.log(`Starting database snapshot export to ${exportDir}`);
    console.log(`Export format: ${opts.format}`);
    console.log(`Include sample data: ${opts.includeSampleData} (size: ${opts.sampleSize})`);
    
    for (const { name, table } of this.tables) {
      console.log(`Exporting table: ${name}`);
      
      const tableExport: TableExport = {
        tableName: name,
        rowCount: 0,
        exportTime: new Date().toISOString()
      };
      
      // Get row count
      if (opts.includeRowCounts) {
        tableExport.rowCount = await this.getTableRowCount(table);
        metadata.totalRows += tableExport.rowCount;
        console.log(`  Row count: ${tableExport.rowCount}`);
      }
      
      // Get sample data
      if (opts.includeSampleData && tableExport.rowCount > 0) {
        const sampleData = await this.getSampleData(table, opts.sampleSize);
        tableExport.sampleData = sampleData;
        console.log(`  Sample data: ${sampleData.length} rows`);
        
        // Export sample data to file
        const fileName = `${name}_sample`;
        switch (opts.format) {
          case 'json':
            fs.writeFileSync(
              path.join(exportDir, `${fileName}.json`),
              JSON.stringify(sampleData, null, 2)
            );
            break;
          case 'csv':
            fs.writeFileSync(
              path.join(exportDir, `${fileName}.csv`),
              this.formatAsCSV(sampleData)
            );
            break;
          case 'sql':
            fs.writeFileSync(
              path.join(exportDir, `${fileName}.sql`),
              this.formatAsSQL(name, sampleData)
            );
            break;
        }
      }
      
      // Get schema info
      if (opts.includeSchemaInfo) {
        tableExport.schemaInfo = await this.getTableSchemaInfo(name);
        console.log(`  Schema info: ${tableExport.schemaInfo ? 'Captured' : 'Failed'}`);
      }
      
      metadata.tables.push(tableExport);
    }
    
    // Write metadata file
    fs.writeFileSync(
      path.join(exportDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
    
    // Generate summary report
    this.generateSummaryReport(metadata, exportDir);
    
    console.log(`\nSnapshot export completed successfully!`);
    console.log(`Total tables: ${metadata.totalTables}`);
    console.log(`Total rows: ${metadata.totalRows}`);
    console.log(`Export location: ${exportDir}`);
    
    return metadata;
  }

  private generateSummaryReport(metadata: SnapshotMetadata, exportDir: string) {
    const report: string[] = [];
    
    report.push('DATABASE SNAPSHOT REPORT');
    report.push('========================');
    report.push('');
    report.push(`Export Time: ${metadata.exportTime}`);
    report.push(`Total Tables: ${metadata.totalTables}`);
    report.push(`Total Rows: ${metadata.totalRows}`);
    report.push('');
    report.push('TABLE SUMMARY');
    report.push('-------------');
    
    // Sort tables by row count
    const sortedTables = [...metadata.tables].sort((a, b) => b.rowCount - a.rowCount);
    
    for (const table of sortedTables) {
      report.push(`${table.tableName}: ${table.rowCount} rows`);
      if (table.sampleData) {
        report.push(`  Sample data: ${table.sampleData.length} rows exported`);
      }
    }
    
    report.push('');
    report.push('EXPORT OPTIONS');
    report.push('--------------');
    report.push(`Format: ${metadata.exportOptions.format}`);
    report.push(`Include Sample Data: ${metadata.exportOptions.includeSampleData}`);
    report.push(`Sample Size: ${metadata.exportOptions.sampleSize}`);
    report.push(`Include Row Counts: ${metadata.exportOptions.includeRowCounts}`);
    report.push(`Include Schema Info: ${metadata.exportOptions.includeSchemaInfo}`);
    
    fs.writeFileSync(path.join(exportDir, 'summary.txt'), report.join('\n'));
  }

  async exportForTesting(limit: number = 10): Promise<Record<string, any>> {
    const testData: Record<string, any> = {
      metadata: {
        exportTime: new Date().toISOString(),
        tableCount: this.tables.length
      },
      tables: {},
      rowCounts: {}
    };
    
    for (const { name, table } of this.tables) {
      try {
        testData.tables[name] = await this.getSampleData(table, limit);
        testData.rowCounts[name] = await this.getTableRowCount(table);
      } catch (error) {
        console.error(`Error exporting ${name} for testing:`, error);
        testData.tables[name] = [];
        testData.rowCounts[name] = -1;
      }
    }
    
    return testData;
  }

  async exportQueryResults(queries: Record<string, string>, outputFile: string): Promise<void> {
    const results: Record<string, any> = {
      exportTime: new Date().toISOString(),
      queries: {}
    };
    
    console.log('Executing custom queries for export...');
    
    for (const [queryName, querySQL] of Object.entries(queries)) {
      try {
        console.log(`Running query: ${queryName}`);
        const result = await this.db.execute(sql.raw(querySQL));
        results.queries[queryName] = {
          success: true,
          rowCount: result.length,
          data: result
        };
      } catch (error) {
        console.error(`Query '${queryName}' failed:`, error);
        results.queries[queryName] = {
          success: false,
          error: error.message
        };
      }
    }
    
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`Query results exported to: ${outputFile}`);
  }

  async compareSnapshots(snapshot1Path: string, snapshot2Path: string): Promise<any> {
    const snap1 = JSON.parse(fs.readFileSync(path.join(snapshot1Path, 'metadata.json'), 'utf-8'));
    const snap2 = JSON.parse(fs.readFileSync(path.join(snapshot2Path, 'metadata.json'), 'utf-8'));
    
    const comparison = {
      snapshot1Time: snap1.exportTime,
      snapshot2Time: snap2.exportTime,
      tableDifferences: [],
      totalRowDifference: snap2.totalRows - snap1.totalRows
    };
    
    for (const table1 of snap1.tables) {
      const table2 = snap2.tables.find(t => t.tableName === table1.tableName);
      if (table2) {
        const diff = table2.rowCount - table1.rowCount;
        if (diff !== 0) {
          comparison.tableDifferences.push({
            table: table1.tableName,
            snapshot1Count: table1.rowCount,
            snapshot2Count: table2.rowCount,
            difference: diff,
            percentChange: ((diff / table1.rowCount) * 100).toFixed(2)
          });
        }
      }
    }
    
    return comparison;
  }
}

// Standalone execution
if (require.main === module) {
  async function main() {
    const snapshot = new DatabaseSnapshot();
    
    try {
      const args = process.argv.slice(2);
      const format = args.includes('--csv') ? 'csv' : args.includes('--sql') ? 'sql' : 'json';
      const includeSamples = !args.includes('--no-samples');
      const sampleSize = parseInt(args.find(a => a.startsWith('--sample-size='))?.split('=')[1] || '100');
      
      console.log('Database Snapshot Export Tool');
      console.log('=============================\n');
      
      const metadata = await snapshot.exportSnapshot({
        format,
        includeSampleData: includeSamples,
        sampleSize,
        includeRowCounts: true,
        includeSchemaInfo: args.includes('--schema')
      });
      
      console.log('\nExport completed successfully!');
      
      if (args.includes('--test-queries')) {
        const testQueries = {
          'recent_work_orders': 'SELECT * FROM work_orders ORDER BY created_at DESC LIMIT 10',
          'low_stock_spares': 'SELECT * FROM spares WHERE rob < min',
          'pending_change_requests': "SELECT * FROM change_request WHERE status = 'submitted'",
          'recent_running_hours': 'SELECT * FROM running_hours_audit ORDER BY entered_at_utc DESC LIMIT 20'
        };
        
        await snapshot.exportQueryResults(
          testQueries,
          path.join(metadata.exportOptions.outputDir, 'test_queries.json')
        );
      }
      
    } catch (error) {
      console.error('Export failed:', error);
      process.exit(1);
    } finally {
      await snapshot.close();
    }
  }
  
  main();
}

export { DatabaseSnapshot, ExportOptions, SnapshotMetadata };