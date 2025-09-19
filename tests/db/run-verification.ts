#!/usr/bin/env tsx
import { DatabaseVerification } from './verification';
import { DatabaseInvariants } from './invariants';
import { DatabaseSnapshot } from './export-snapshot';
import { nanoid } from 'nanoid';
import * as fs from 'fs';
import * as path from 'path';

interface VerificationReport {
  runId: string;
  timestamp: string;
  environment: string;
  databaseUrl: string;
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    errors: number;
    warnings: number;
    info: number;
  };
  performance: {
    totalDuration: number;
    totalQueries: number;
    averageQueryTime: number;
    slowestQuery: { name: string; duration: number };
  };
  tableStatistics: Record<string, number>;
  verificationResults: any;
  invariantResults: any;
  sampleData?: any;
}

class VerificationRunner {
  private dbVerifier: DatabaseVerification;
  private dbInvariants: DatabaseInvariants;
  private dbSnapshot: DatabaseSnapshot;
  private report: VerificationReport;
  private outputDir: string;

  constructor() {
    this.dbVerifier = new DatabaseVerification();
    this.dbInvariants = new DatabaseInvariants();
    this.dbSnapshot = new DatabaseSnapshot();
    this.outputDir = './verification-reports';
    
    // Create output directory
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async close() {
    await this.dbVerifier.close();
    await this.dbInvariants.close();
    await this.dbSnapshot.close();
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }

  private printSection(title: string, symbol: string = '=') {
    const line = symbol.repeat(50);
    console.log(`\n${line}`);
    console.log(title.toUpperCase());
    console.log(line);
  }

  private printSubsection(title: string) {
    console.log(`\n${title}`);
    console.log('-'.repeat(title.length));
  }

  async runFullVerification(options: {
    exportSnapshot?: boolean;
    includeInvariants?: boolean;
    generateHtml?: boolean;
    cleanupTestData?: boolean;
  } = {}) {
    const runId = nanoid(8);
    const startTime = Date.now();
    
    // Initialize report
    this.report = {
      runId,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      databaseUrl: process.env.DATABASE_URL ? '***REDACTED***' : 'N/A',
      summary: {
        totalChecks: 0,
        passed: 0,
        failed: 0,
        errors: 0,
        warnings: 0,
        info: 0
      },
      performance: {
        totalDuration: 0,
        totalQueries: 0,
        averageQueryTime: 0,
        slowestQuery: { name: '', duration: 0 }
      },
      tableStatistics: {},
      verificationResults: {},
      invariantResults: {}
    };

    // Print header
    this.printSection('DATABASE VERIFICATION SUITE');
    console.log(`Run ID: ${runId}`);
    console.log(`Timestamp: ${this.report.timestamp}`);
    console.log(`Environment: ${this.report.environment}`);
    
    try {
      // Step 1: Run basic verification checks
      this.printSection('STEP 1: BASIC VERIFICATION CHECKS', '-');
      const verificationResults = await this.dbVerifier.runAllVerifications();
      this.report.verificationResults = verificationResults;
      this.report.tableStatistics = verificationResults.rowCounts;
      
      // Process verification results
      for (const [checkName, result] of Object.entries(verificationResults.results)) {
        this.printSubsection(`${checkName.replace(/([A-Z])/g, ' $1').trim()}`);
        
        if (result.valid) {
          console.log('  ✅ PASSED');
          this.report.summary.passed++;
        } else {
          console.log('  ❌ FAILED');
          this.report.summary.failed++;
        }
        
        // Print errors
        if (result.errors && result.errors.length > 0) {
          console.log('  Errors:');
          result.errors.forEach(e => {
            console.log(`    ⚠️  ${e}`);
            this.report.summary.errors++;
          });
        }
        
        // Print warnings
        if (result.warnings && result.warnings.length > 0) {
          console.log('  Warnings:');
          result.warnings.forEach(w => {
            console.log(`    ⚠  ${w}`);
            this.report.summary.warnings++;
          });
        }
        
        // Print info
        if (result.info && result.info.length > 0) {
          console.log('  Info:');
          result.info.forEach((i: string) => {
            if (i.length <= 100) {
              console.log(`    ℹ  ${i}`);
            } else {
              console.log(`    ℹ  ${i.substring(0, 100)}...`);
            }
            this.report.summary.info++;
          });
        }
        
        // Track performance
        if (result.performance) {
          this.report.performance.totalQueries++;
          if (result.performance.queryTime > this.report.performance.slowestQuery.duration) {
            this.report.performance.slowestQuery = {
              name: checkName,
              duration: result.performance.queryTime
            };
          }
        }
        
        this.report.summary.totalChecks++;
      }
      
      // Step 2: Run invariant checks
      if (options.includeInvariants !== false) {
        this.printSection('STEP 2: DATABASE INVARIANTS', '-');
        const invariantResults = await this.dbInvariants.runAllChecks();
        this.report.invariantResults = invariantResults;
        
        console.log(`\nTotal Invariant Checks: ${invariantResults.summary.total}`);
        console.log(`Passed: ${invariantResults.summary.passed}`);
        console.log(`Failed: ${invariantResults.summary.failed}`);
        console.log(`Errors: ${invariantResults.summary.errors}`);
        console.log(`Warnings: ${invariantResults.summary.warnings}`);
        
        // Show failed invariants in detail
        const failedInvariants = invariantResults.results.filter(r => !r.passed);
        if (failedInvariants.length > 0) {
          this.printSubsection('Failed Invariants');
          for (const invariant of failedInvariants) {
            console.log(`\n  ${invariant.name} (${invariant.severity})`);
            console.log(`  ${invariant.description}`);
            if (invariant.violations.length > 0) {
              console.log('  Violations:');
              invariant.violations.slice(0, 5).forEach(v => {
                console.log(`    - ${v}`);
              });
              if (invariant.violations.length > 5) {
                console.log(`    ... and ${invariant.violations.length - 5} more`);
              }
            }
          }
        }
        
        this.report.summary.totalChecks += invariantResults.summary.total;
        this.report.summary.passed += invariantResults.summary.passed;
        this.report.summary.failed += invariantResults.summary.failed;
      }
      
      // Step 3: Table Statistics
      this.printSection('STEP 3: TABLE STATISTICS', '-');
      console.log('\nRow Counts:');
      const sortedTables = Object.entries(verificationResults.rowCounts)
        .sort(([, a], [, b]) => b - a);
      
      for (const [table, count] of sortedTables) {
        if (count === -1) {
          console.log(`  ${table.padEnd(25)} : ERROR`);
        } else {
          console.log(`  ${table.padEnd(25)} : ${count.toLocaleString()} rows`);
        }
      }
      
      const totalRows = Object.values(verificationResults.rowCounts)
        .filter(c => c !== -1)
        .reduce((sum, c) => sum + c, 0);
      console.log(`\n  Total Rows: ${totalRows.toLocaleString()}`);
      
      // Step 4: Export snapshot if requested
      if (options.exportSnapshot) {
        this.printSection('STEP 4: EXPORTING SNAPSHOT', '-');
        const snapshotMetadata = await this.dbSnapshot.exportSnapshot({
          format: 'json',
          includeSampleData: true,
          sampleSize: 50,
          outputDir: path.join(this.outputDir, runId),
          includeRowCounts: true,
          includeSchemaInfo: false
        });
        
        console.log(`✅ Snapshot exported to: ${path.join(this.outputDir, runId)}`);
        console.log(`   Total tables: ${snapshotMetadata.totalTables}`);
        console.log(`   Total rows: ${snapshotMetadata.totalRows}`);
        
        // Get sample data for report
        this.report.sampleData = await this.dbSnapshot.exportForTesting(5);
      }
      
      // Step 5: Performance Summary
      this.printSection('STEP 5: PERFORMANCE METRICS', '-');
      const endTime = Date.now();
      this.report.performance.totalDuration = endTime - startTime;
      this.report.performance.averageQueryTime = verificationResults.totalQueryTime / 
        Math.max(this.report.performance.totalQueries, 1);
      
      console.log(`Total Duration: ${this.formatDuration(this.report.performance.totalDuration)}`);
      console.log(`Total Query Time: ${this.formatDuration(verificationResults.totalQueryTime)}`);
      console.log(`Total Queries: ${this.report.performance.totalQueries}`);
      console.log(`Average Query Time: ${this.formatDuration(this.report.performance.averageQueryTime)}`);
      console.log(`Slowest Query: ${this.report.performance.slowestQuery.name} (${this.formatDuration(this.report.performance.slowestQuery.duration)})`);
      
      // Step 6: Cleanup test data if requested
      if (options.cleanupTestData) {
        this.printSection('STEP 6: CLEANUP', '-');
        await this.dbVerifier.cleanupTestData('test_');
        console.log('✅ Test data cleanup completed');
      }
      
      // Generate reports
      await this.generateReports(options.generateHtml !== false);
      
      // Final Summary
      this.printSection('VERIFICATION COMPLETE', '=');
      
      const allPassed = this.report.summary.failed === 0 && this.report.summary.errors === 0;
      
      if (allPassed) {
        console.log('\n✅ ALL VERIFICATION CHECKS PASSED');
      } else {
        console.log('\n❌ SOME VERIFICATION CHECKS FAILED');
      }
      
      console.log(`\nSummary:`);
      console.log(`  Total Checks: ${this.report.summary.totalChecks}`);
      console.log(`  Passed: ${this.report.summary.passed}`);
      console.log(`  Failed: ${this.report.summary.failed}`);
      console.log(`  Errors: ${this.report.summary.errors}`);
      console.log(`  Warnings: ${this.report.summary.warnings}`);
      console.log(`  Info Messages: ${this.report.summary.info}`);
      
      console.log(`\nReports generated in: ${this.outputDir}`);
      console.log(`  - ${runId}-report.json`);
      if (options.generateHtml !== false) {
        console.log(`  - ${runId}-report.html`);
      }
      
      return this.report;
      
    } catch (error) {
      console.error('\n❌ Fatal error during verification:', error);
      this.report.summary.errors++;
      throw error;
    }
  }

  private async generateReports(generateHtml: boolean) {
    const runId = this.report.runId;
    
    // Save JSON report
    const jsonPath = path.join(this.outputDir, `${runId}-report.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(this.report, null, 2));
    
    // Generate HTML report if requested
    if (generateHtml) {
      const htmlPath = path.join(this.outputDir, `${runId}-report.html`);
      const htmlContent = this.generateHtmlReport();
      fs.writeFileSync(htmlPath, htmlContent);
    }
    
    // Generate summary text file
    const summaryPath = path.join(this.outputDir, `${runId}-summary.txt`);
    const summaryContent = this.generateTextSummary();
    fs.writeFileSync(summaryPath, summaryContent);
  }

  private generateHtmlReport(): string {
    const report = this.report;
    const allPassed = report.summary.failed === 0 && report.summary.errors === 0;
    const statusColor = allPassed ? '#4CAF50' : '#F44336';
    const statusText = allPassed ? 'PASSED' : 'FAILED';
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Verification Report - ${report.runId}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: white; border-radius: 8px; padding: 30px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header h1 { color: #2c3e50; margin-bottom: 20px; }
        .status-badge { display: inline-block; padding: 8px 16px; border-radius: 20px; color: white; font-weight: bold; background: ${statusColor}; }
        .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 20px; }
        .info-item { background: #f8f9fa; padding: 10px; border-radius: 4px; }
        .info-label { font-size: 12px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; }
        .info-value { font-size: 18px; font-weight: 600; color: #2c3e50; }
        .section { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .section h2 { color: #2c3e50; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e0e0e0; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0; }
        .metric { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; }
        .metric-value { font-size: 24px; font-weight: bold; color: #2c3e50; }
        .metric-label { font-size: 12px; color: #666; margin-top: 5px; }
        .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .table th { background: #f8f9fa; text-align: left; padding: 10px; font-weight: 600; color: #2c3e50; }
        .table td { padding: 10px; border-top: 1px solid #e0e0e0; }
        .table tr:hover { background: #f8f9fa; }
        .check-passed { color: #4CAF50; font-weight: 600; }
        .check-failed { color: #F44336; font-weight: 600; }
        .check-warning { color: #FF9800; font-weight: 600; }
        .error-list { background: #ffebee; border-left: 4px solid #F44336; padding: 10px 15px; margin: 10px 0; border-radius: 4px; }
        .warning-list { background: #fff3e0; border-left: 4px solid #FF9800; padding: 10px 15px; margin: 10px 0; border-radius: 4px; }
        .info-list { background: #e3f2fd; border-left: 4px solid #2196F3; padding: 10px 15px; margin: 10px 0; border-radius: 4px; }
        .list-item { margin: 5px 0; font-size: 14px; }
        .footer { text-align: center; color: #666; margin-top: 40px; padding: 20px; }
        .collapsible { cursor: pointer; user-select: none; }
        .collapsible:after { content: '▼'; float: right; }
        .collapsible.active:after { content: '▲'; }
        .content { max-height: 0; overflow: hidden; transition: max-height 0.2s ease-out; }
        .content.show { max-height: none; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Database Verification Report</h1>
            <span class="status-badge">${statusText}</span>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Run ID</div>
                    <div class="info-value">${report.runId}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Timestamp</div>
                    <div class="info-value">${new Date(report.timestamp).toLocaleString()}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Environment</div>
                    <div class="info-value">${report.environment}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Duration</div>
                    <div class="info-value">${this.formatDuration(report.performance.totalDuration)}</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Summary</h2>
            <div class="metric-grid">
                <div class="metric">
                    <div class="metric-value">${report.summary.totalChecks}</div>
                    <div class="metric-label">Total Checks</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color: #4CAF50;">${report.summary.passed}</div>
                    <div class="metric-label">Passed</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color: #F44336;">${report.summary.failed}</div>
                    <div class="metric-label">Failed</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color: #F44336;">${report.summary.errors}</div>
                    <div class="metric-label">Errors</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color: #FF9800;">${report.summary.warnings}</div>
                    <div class="metric-label">Warnings</div>
                </div>
                <div class="metric">
                    <div class="metric-value" style="color: #2196F3;">${report.summary.info}</div>
                    <div class="metric-label">Info</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Verification Results</h2>
            ${this.generateVerificationResultsHtml()}
        </div>

        ${report.invariantResults.results ? `
        <div class="section">
            <h2>Invariant Checks</h2>
            ${this.generateInvariantResultsHtml()}
        </div>
        ` : ''}

        <div class="section">
            <h2>Table Statistics</h2>
            <table class="table">
                <thead>
                    <tr>
                        <th>Table Name</th>
                        <th style="text-align: right;">Row Count</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(report.tableStatistics)
                      .sort(([, a], [, b]) => b - a)
                      .map(([table, count]) => `
                        <tr>
                            <td>${table}</td>
                            <td style="text-align: right;">${count === -1 ? 'ERROR' : count.toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>Performance Metrics</h2>
            <div class="metric-grid">
                <div class="metric">
                    <div class="metric-value">${this.formatDuration(report.performance.totalDuration)}</div>
                    <div class="metric-label">Total Duration</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${report.performance.totalQueries}</div>
                    <div class="metric-label">Total Queries</div>
                </div>
                <div class="metric">
                    <div class="metric-value">${this.formatDuration(report.performance.averageQueryTime)}</div>
                    <div class="metric-label">Avg Query Time</div>
                </div>
            </div>
            ${report.performance.slowestQuery.name ? `
            <div style="margin-top: 20px;">
                <strong>Slowest Query:</strong> ${report.performance.slowestQuery.name} 
                (${this.formatDuration(report.performance.slowestQuery.duration)})
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>Generated by Database Verification Suite</p>
            <p>${new Date().toLocaleString()}</p>
        </div>
    </div>

    <script>
        document.querySelectorAll('.collapsible').forEach(elem => {
            elem.addEventListener('click', function() {
                this.classList.toggle('active');
                const content = this.nextElementSibling;
                content.classList.toggle('show');
            });
        });
    </script>
</body>
</html>`;
  }

  private generateVerificationResultsHtml(): string {
    const results = this.report.verificationResults.results;
    const html: string[] = [];
    
    for (const [checkName, result] of Object.entries(results)) {
      const displayName = checkName.replace(/([A-Z])/g, ' $1').trim();
      const statusClass = result.valid ? 'check-passed' : 'check-failed';
      const statusText = result.valid ? 'PASSED' : 'FAILED';
      
      html.push(`
        <div style="margin-bottom: 20px;">
          <h3 class="collapsible" style="cursor: pointer;">
            ${displayName} 
            <span class="${statusClass}" style="float: right;">${statusText}</span>
          </h3>
          <div class="content">
      `);
      
      if (result.errors && result.errors.length > 0) {
        html.push('<div class="error-list">');
        html.push('<strong>Errors:</strong>');
        result.errors.forEach(e => {
          html.push(`<div class="list-item">• ${this.escapeHtml(e)}</div>`);
        });
        html.push('</div>');
      }
      
      if (result.warnings && result.warnings.length > 0) {
        html.push('<div class="warning-list">');
        html.push('<strong>Warnings:</strong>');
        result.warnings.forEach(w => {
          html.push(`<div class="list-item">• ${this.escapeHtml(w)}</div>`);
        });
        html.push('</div>');
      }
      
      if (result.info && result.info.length > 0) {
        html.push('<div class="info-list">');
        html.push('<strong>Information:</strong>');
        result.info.slice(0, 10).forEach(i => {
          html.push(`<div class="list-item">• ${this.escapeHtml(i)}</div>`);
        });
        if (result.info.length > 10) {
          html.push(`<div class="list-item">... and ${result.info.length - 10} more</div>`);
        }
        html.push('</div>');
      }
      
      html.push('</div></div>');
    }
    
    return html.join('');
  }

  private generateInvariantResultsHtml(): string {
    const results = this.report.invariantResults.results || [];
    const html: string[] = [];
    
    for (const result of results) {
      const statusClass = result.passed ? 'check-passed' : 
                          result.severity === 'error' ? 'check-failed' : 'check-warning';
      const statusText = result.passed ? 'PASSED' : 'FAILED';
      
      html.push(`
        <div style="margin-bottom: 20px;">
          <h3 class="collapsible" style="cursor: pointer;">
            ${result.name} 
            <span class="${statusClass}" style="float: right;">${statusText}</span>
          </h3>
          <div class="content">
            <p style="color: #666; margin: 10px 0;">${result.description}</p>
      `);
      
      if (!result.passed && result.violations.length > 0) {
        const listClass = result.severity === 'error' ? 'error-list' : 
                         result.severity === 'warning' ? 'warning-list' : 'info-list';
        html.push(`<div class="${listClass}">`);
        html.push(`<strong>Violations (${result.violations.length}):</strong>`);
        result.violations.slice(0, 10).forEach(v => {
          html.push(`<div class="list-item">• ${this.escapeHtml(v)}</div>`);
        });
        if (result.violations.length > 10) {
          html.push(`<div class="list-item">... and ${result.violations.length - 10} more</div>`);
        }
        html.push('</div>');
      }
      
      if (result.performance) {
        html.push(`
          <div style="margin-top: 10px; color: #666; font-size: 14px;">
            Duration: ${this.formatDuration(result.performance.duration)} | 
            Records Checked: ${result.performance.recordsChecked}
          </div>
        `);
      }
      
      html.push('</div></div>');
    }
    
    return html.join('');
  }

  private escapeHtml(text: string): string {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  private generateTextSummary(): string {
    const report = this.report;
    const lines: string[] = [];
    
    lines.push('DATABASE VERIFICATION SUMMARY');
    lines.push('=' .repeat(50));
    lines.push('');
    lines.push(`Run ID: ${report.runId}`);
    lines.push(`Timestamp: ${report.timestamp}`);
    lines.push(`Environment: ${report.environment}`);
    lines.push(`Duration: ${this.formatDuration(report.performance.totalDuration)}`);
    lines.push('');
    lines.push('RESULTS');
    lines.push('-'.repeat(50));
    lines.push(`Total Checks: ${report.summary.totalChecks}`);
    lines.push(`Passed: ${report.summary.passed}`);
    lines.push(`Failed: ${report.summary.failed}`);
    lines.push(`Errors: ${report.summary.errors}`);
    lines.push(`Warnings: ${report.summary.warnings}`);
    lines.push(`Info Messages: ${report.summary.info}`);
    lines.push('');
    lines.push('PERFORMANCE');
    lines.push('-'.repeat(50));
    lines.push(`Total Queries: ${report.performance.totalQueries}`);
    lines.push(`Average Query Time: ${this.formatDuration(report.performance.averageQueryTime)}`);
    if (report.performance.slowestQuery.name) {
      lines.push(`Slowest Query: ${report.performance.slowestQuery.name} (${this.formatDuration(report.performance.slowestQuery.duration)})`);
    }
    lines.push('');
    lines.push('TABLE STATISTICS');
    lines.push('-'.repeat(50));
    const totalRows = Object.values(report.tableStatistics)
      .filter(c => c !== -1)
      .reduce((sum, c) => sum + c, 0);
    lines.push(`Total Rows: ${totalRows.toLocaleString()}`);
    lines.push('');
    
    const allPassed = report.summary.failed === 0 && report.summary.errors === 0;
    lines.push('STATUS: ' + (allPassed ? '✅ PASSED' : '❌ FAILED'));
    
    return lines.join('\n');
  }
}

// Main execution
async function main() {
  const runner = new VerificationRunner();
  
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {
      exportSnapshot: args.includes('--snapshot'),
      includeInvariants: !args.includes('--skip-invariants'),
      generateHtml: !args.includes('--no-html'),
      cleanupTestData: args.includes('--cleanup')
    };
    
    if (args.includes('--help')) {
      console.log('Database Verification Runner');
      console.log('');
      console.log('Usage: tsx run-verification.ts [options]');
      console.log('');
      console.log('Options:');
      console.log('  --snapshot         Export database snapshot');
      console.log('  --skip-invariants  Skip invariant checks');
      console.log('  --no-html          Skip HTML report generation');
      console.log('  --cleanup          Cleanup test data after verification');
      console.log('  --help             Show this help message');
      process.exit(0);
    }
    
    const report = await runner.runFullVerification(options);
    
    // Exit with appropriate code
    const success = report.summary.failed === 0 && report.summary.errors === 0;
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { VerificationRunner, VerificationReport };