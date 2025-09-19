import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  components,
  workOrders,
  spares,
  sparesHistory,
  storesLedger,
  runningHoursAudit,
  changeRequest
} from '../../shared/schema';
import { eq, sql, and, gte, lte, ne, isNull, desc, asc } from 'drizzle-orm';

interface InvariantCheck {
  name: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  check: () => Promise<InvariantResult>;
}

interface InvariantResult {
  passed: boolean;
  violations: string[];
  details?: any;
  performance?: {
    duration: number;
    recordsChecked: number;
  };
}

export class DatabaseInvariants {
  private db: any;
  private client: any;
  private checks: InvariantCheck[] = [];

  constructor(connectionString?: string) {
    const dbUrl = connectionString || process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }
    this.client = postgres(dbUrl);
    this.db = drizzle(this.client);
    this.initializeChecks();
  }

  async close(): Promise<void> {
    await this.client.end();
  }

  private initializeChecks() {
    this.checks = [
      {
        name: 'No Negative ROB Values',
        description: 'Ensures no negative Remaining on Board values exist in spares or stores',
        severity: 'error',
        check: () => this.checkNoNegativeROB()
      },
      {
        name: 'Unique Component Codes',
        description: 'Ensures component codes are unique within the system',
        severity: 'error',
        check: () => this.checkUniqueComponentCodes()
      },
      {
        name: 'Unique Spare Codes',
        description: 'Ensures spare codes are unique per vessel',
        severity: 'error',
        check: () => this.checkUniqueSparesCodes()
      },
      {
        name: 'Work Order Approval Integrity',
        description: 'Ensures completed work orders have proper approval records',
        severity: 'error',
        check: () => this.checkWorkOrderApprovals()
      },
      {
        name: 'Change Request Field Tracking',
        description: 'Ensures change requests properly track old and new values',
        severity: 'error',
        check: () => this.checkChangeRequestFields()
      },
      {
        name: 'Meter Replacement Integrity',
        description: 'Ensures meter replacement events are properly linked',
        severity: 'error',
        check: () => this.checkMeterReplacementIntegrity()
      },
      {
        name: 'No Orphan Work Orders',
        description: 'Ensures work orders reference valid components',
        severity: 'warning',
        check: () => this.checkNoOrphanWorkOrders()
      },
      {
        name: 'No Orphan Spares',
        description: 'Ensures spares reference valid components',
        severity: 'error',
        check: () => this.checkNoOrphanSpares()
      },
      {
        name: 'Running Hours Consistency',
        description: 'Ensures running hours are cumulative and consistent',
        severity: 'error',
        check: () => this.checkRunningHoursConsistency()
      },
      {
        name: 'Spares History Consistency',
        description: 'Ensures spare consumption history matches current ROB',
        severity: 'warning',
        check: () => this.checkSparesHistoryConsistency()
      },
      {
        name: 'Valid Status Transitions',
        description: 'Ensures all status fields contain valid values',
        severity: 'error',
        check: () => this.checkValidStatusTransitions()
      },
      {
        name: 'Audit Trail Completeness',
        description: 'Ensures audit trails have user and timestamp data',
        severity: 'error',
        check: () => this.checkAuditTrailCompleteness()
      },
      {
        name: 'Component Hierarchy Integrity',
        description: 'Ensures no circular dependencies in component hierarchy',
        severity: 'error',
        check: () => this.checkComponentHierarchyIntegrity()
      },
      {
        name: 'Date Consistency',
        description: 'Ensures dates follow logical order (e.g., creation before completion)',
        severity: 'warning',
        check: () => this.checkDateConsistency()
      },
      {
        name: 'Required Fields Completeness',
        description: 'Ensures all required fields are populated',
        severity: 'warning',
        check: () => this.checkRequiredFields()
      }
    ];
  }

  private async checkNoNegativeROB(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    let recordsChecked = 0;

    // Check spares
    const negativeSpares = await this.db.select()
      .from(spares)
      .where(sql`${spares.rob} < 0`);
    
    recordsChecked += negativeSpares.length;
    for (const spare of negativeSpares) {
      violations.push(`Spare '${spare.partCode}' has negative ROB: ${spare.rob}`);
    }

    // Check stores ledger
    const negativeStores = await this.db.select()
      .from(storesLedger)
      .where(sql`${storesLedger.robAfterBase} < 0`);
    
    recordsChecked += negativeStores.length;
    for (const store of negativeStores) {
      violations.push(`Store ledger entry #${store.id} has negative ROB: ${store.robAfterBase}`);
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked
      }
    };
  }

  private async checkUniqueComponentCodes(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    
    const duplicates = await this.db.execute(sql`
      SELECT component_code, COUNT(*) as count
      FROM ${components}
      WHERE component_code IS NOT NULL
      GROUP BY component_code
      HAVING COUNT(*) > 1
    `);
    
    for (const dup of duplicates) {
      violations.push(`Component code '${dup.component_code}' appears ${dup.count} times`);
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked: duplicates.length
      }
    };
  }

  private async checkUniqueSparesCodes(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    
    const duplicates = await this.db.execute(sql`
      SELECT vessel_id, component_spare_code, COUNT(*) as count
      FROM ${spares}
      WHERE component_spare_code IS NOT NULL
      GROUP BY vessel_id, component_spare_code
      HAVING COUNT(*) > 1
    `);
    
    for (const dup of duplicates) {
      violations.push(`Spare code '${dup.component_spare_code}' appears ${dup.count} times in vessel ${dup.vessel_id}`);
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked: duplicates.length
      }
    };
  }

  private async checkWorkOrderApprovals(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    
    const completedWithoutApproval = await this.db.select()
      .from(workOrders)
      .where(and(
        eq(workOrders.status, 'Completed'),
        isNull(workOrders.approver)
      ));
    
    for (const wo of completedWithoutApproval) {
      violations.push(`Work Order '${wo.workOrderNo}' is completed without approval`);
    }

    // Check for approvals without dates
    const approvedWithoutDate = await this.db.select()
      .from(workOrders)
      .where(and(
        eq(workOrders.status, 'Completed'),
        sql`${workOrders.approver} IS NOT NULL`,
        isNull(workOrders.approvalDate)
      ));
    
    for (const wo of approvedWithoutDate) {
      violations.push(`Work Order '${wo.workOrderNo}' has approver but no approval date`);
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked: completedWithoutApproval.length + approvedWithoutDate.length
      }
    };
  }

  private async checkChangeRequestFields(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    let recordsChecked = 0;
    
    const changeRequests = await this.db.select()
      .from(changeRequest)
      .where(sql`${changeRequest.status} IN ('approved', 'implemented')`);
    
    recordsChecked = changeRequests.length;
    
    for (const cr of changeRequests) {
      if (!cr.proposedChangesJson) {
        violations.push(`Change Request #${cr.id} missing proposed changes`);
        continue;
      }
      
      try {
        const changes = typeof cr.proposedChangesJson === 'string' 
          ? JSON.parse(cr.proposedChangesJson) 
          : cr.proposedChangesJson;
        
        if (!Array.isArray(changes)) {
          violations.push(`Change Request #${cr.id} has invalid changes format`);
          continue;
        }
        
        for (let i = 0; i < changes.length; i++) {
          const change = changes[i];
          if (!change.field) {
            violations.push(`Change Request #${cr.id} change[${i}] missing field name`);
          }
          if (change.oldValue === undefined && change.newValue === undefined) {
            violations.push(`Change Request #${cr.id} change[${i}] missing both old and new values`);
          }
        }
      } catch (error) {
        violations.push(`Change Request #${cr.id} has invalid JSON`);
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked
      }
    };
  }

  private async checkMeterReplacementIntegrity(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    
    const meterReplacements = await this.db.select()
      .from(runningHoursAudit)
      .where(eq(runningHoursAudit.meterReplaced, true));
    
    const componentIds = new Set(
      (await this.db.select({ id: components.id }).from(components))
        .map(c => c.id)
    );
    
    for (const event of meterReplacements) {
      if (event.oldMeterFinal === null || event.oldMeterFinal === undefined) {
        violations.push(`Meter replacement #${event.id} missing old meter final reading`);
      }
      if (event.newMeterStart === null || event.newMeterStart === undefined) {
        violations.push(`Meter replacement #${event.id} missing new meter start reading`);
      }
      if (!componentIds.has(event.componentId)) {
        violations.push(`Meter replacement #${event.id} references non-existent component '${event.componentId}'`);
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked: meterReplacements.length
      }
    };
  }

  private async checkNoOrphanWorkOrders(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    
    const componentCodes = new Set(
      (await this.db.select({ code: components.componentCode }).from(components)
        .where(sql`${components.componentCode} IS NOT NULL`))
        .map(c => c.code)
    );
    
    const workOrdersWithCodes = await this.db.select()
      .from(workOrders)
      .where(sql`${workOrders.componentCode} IS NOT NULL`);
    
    for (const wo of workOrdersWithCodes) {
      if (wo.componentCode && !componentCodes.has(wo.componentCode)) {
        violations.push(`Work Order '${wo.workOrderNo}' references non-existent component code '${wo.componentCode}'`);
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked: workOrdersWithCodes.length
      }
    };
  }

  private async checkNoOrphanSpares(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    
    const componentIds = new Set(
      (await this.db.select({ id: components.id }).from(components))
        .map(c => c.id)
    );
    
    const allSpares = await this.db.select().from(spares);
    
    for (const spare of allSpares) {
      if (!componentIds.has(spare.componentId)) {
        violations.push(`Spare '${spare.partCode}' references non-existent component '${spare.componentId}'`);
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked: allSpares.length
      }
    };
  }

  private async checkRunningHoursConsistency(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    let recordsChecked = 0;
    
    const allComponents = await this.db.select().from(components);
    
    for (const comp of allComponents) {
      const audits = await this.db.select()
        .from(runningHoursAudit)
        .where(eq(runningHoursAudit.componentId, comp.id))
        .orderBy(asc(runningHoursAudit.enteredAtUTC));
      
      recordsChecked += audits.length;
      
      if (audits.length > 0) {
        // Check latest audit matches component
        const latestAudit = audits[audits.length - 1];
        const componentRH = parseFloat(comp.currentCumulativeRH || '0');
        const auditRH = parseFloat(latestAudit.cumulativeRH || '0');
        
        if (Math.abs(componentRH - auditRH) > 0.01) {
          violations.push(`Component '${comp.id}' RH mismatch: ${componentRH} vs audit ${auditRH}`);
        }
        
        // Check for negative values
        for (const audit of audits) {
          if (parseFloat(audit.newRH) < 0) {
            violations.push(`Negative RH delta in audit #${audit.id}`);
          }
          if (parseFloat(audit.cumulativeRH) < 0) {
            violations.push(`Negative cumulative RH in audit #${audit.id}`);
          }
        }
        
        // Check chronological consistency
        let prevCumulative = 0;
        for (const audit of audits) {
          const cumulative = parseFloat(audit.cumulativeRH);
          if (cumulative < prevCumulative && !audit.meterReplaced) {
            violations.push(`RH decreased without meter replacement for component '${comp.id}'`);
          }
          prevCumulative = cumulative;
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked
      }
    };
  }

  private async checkSparesHistoryConsistency(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    let recordsChecked = 0;
    
    const allSpares = await this.db.select().from(spares);
    
    for (const spare of allSpares) {
      const history = await this.db.select()
        .from(sparesHistory)
        .where(eq(sparesHistory.spareId, spare.id))
        .orderBy(asc(sparesHistory.timestampUTC));
      
      recordsChecked += history.length;
      
      if (history.length > 0) {
        const lastEvent = history[history.length - 1];
        if (lastEvent.robAfter !== spare.rob) {
          violations.push(`Spare '${spare.partCode}' ROB mismatch: current=${spare.rob}, history=${lastEvent.robAfter}`);
        }
        
        // Calculate expected ROB from history
        let calculatedROB = 0;
        for (const event of history) {
          calculatedROB += event.qtyChange;
        }
        
        if (Math.abs(calculatedROB - spare.rob) > 0.001) {
          violations.push(`Spare '${spare.partCode}' calculated ROB (${calculatedROB}) doesn't match current (${spare.rob})`);
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked
      }
    };
  }

  private async checkValidStatusTransitions(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    let recordsChecked = 0;
    
    // Work Order statuses
    const validWOStatuses = ['Completed', 'Due', 'Due (Grace P)', 'Overdue', 'Postponed', 'Pending Approval'];
    const invalidWOs = await this.db.select()
      .from(workOrders)
      .where(sql`${workOrders.status} NOT IN (${sql.join(validWOStatuses.map(s => sql.lit(s)), sql`, `)})`);
    
    recordsChecked += invalidWOs.length;
    for (const wo of invalidWOs) {
      violations.push(`Work Order '${wo.workOrderNo}' has invalid status: '${wo.status}'`);
    }
    
    // Change Request statuses
    const validCRStatuses = ['draft', 'submitted', 'returned', 'approved', 'rejected'];
    const invalidCRs = await this.db.select()
      .from(changeRequest)
      .where(sql`${changeRequest.status} NOT IN (${sql.join(validCRStatuses.map(s => sql.lit(s)), sql`, `)})`);
    
    recordsChecked += invalidCRs.length;
    for (const cr of invalidCRs) {
      violations.push(`Change Request #${cr.id} has invalid status: '${cr.status}'`);
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked
      }
    };
  }

  private async checkAuditTrailCompleteness(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    let recordsChecked = 0;
    
    // Check running hours audit
    const rhAuditIncomplete = await this.db.select()
      .from(runningHoursAudit)
      .where(sql`${runningHoursAudit.userId} IS NULL OR ${runningHoursAudit.enteredAtUTC} IS NULL`);
    
    recordsChecked += rhAuditIncomplete.length;
    for (const audit of rhAuditIncomplete) {
      violations.push(`Running Hours Audit #${audit.id} missing user or timestamp`);
    }
    
    // Check spares history
    const sparesHistoryIncomplete = await this.db.select()
      .from(sparesHistory)
      .where(sql`${sparesHistory.userId} IS NULL OR ${sparesHistory.timestampUTC} IS NULL`);
    
    recordsChecked += sparesHistoryIncomplete.length;
    for (const history of sparesHistoryIncomplete) {
      violations.push(`Spares History #${history.id} missing user or timestamp`);
    }
    
    // Check stores ledger
    const storesLedgerIncomplete = await this.db.select()
      .from(storesLedger)
      .where(sql`${storesLedger.userId} IS NULL OR ${storesLedger.timestampUTC} IS NULL`);
    
    recordsChecked += storesLedgerIncomplete.length;
    for (const ledger of storesLedgerIncomplete) {
      violations.push(`Stores Ledger #${ledger.id} missing user or timestamp`);
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked
      }
    };
  }

  private async checkComponentHierarchyIntegrity(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    
    const allComponents = await this.db.select().from(components);
    
    // Check for circular dependencies
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCycle = (id: string): boolean => {
      visited.add(id);
      recursionStack.add(id);
      
      const children = allComponents.filter(c => c.parentId === id);
      for (const child of children) {
        if (!visited.has(child.id) && hasCycle(child.id)) {
          return true;
        } else if (recursionStack.has(child.id)) {
          violations.push(`Circular dependency: ${id} -> ${child.id}`);
          return true;
        }
      }
      
      recursionStack.delete(id);
      return false;
    };
    
    const roots = allComponents.filter(c => !c.parentId);
    for (const root of roots) {
      hasCycle(root.id);
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked: allComponents.length
      }
    };
  }

  private async checkDateConsistency(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    let recordsChecked = 0;
    
    // Check work orders
    const workOrdersWithDates = await this.db.select()
      .from(workOrders)
      .where(sql`${workOrders.dateCompleted} IS NOT NULL`);
    
    recordsChecked += workOrdersWithDates.length;
    const today = new Date();
    
    for (const wo of workOrdersWithDates) {
      if (wo.dateCompleted) {
        const completedDate = new Date(wo.dateCompleted);
        if (completedDate > today) {
          violations.push(`Work Order '${wo.workOrderNo}' has future completion date`);
        }
        
        if (wo.dueDate) {
          const dueDate = new Date(wo.dueDate);
          if (wo.createdAt && new Date(wo.createdAt) > dueDate) {
            violations.push(`Work Order '${wo.workOrderNo}' created after due date`);
          }
        }
      }
    }
    
    // Check change requests
    const changeRequests = await this.db.select()
      .from(changeRequest)
      .where(sql`${changeRequest.reviewedAt} IS NOT NULL`);
    
    recordsChecked += changeRequests.length;
    
    for (const cr of changeRequests) {
      if (cr.reviewedAt && cr.submittedAt && new Date(cr.reviewedAt) < new Date(cr.submittedAt)) {
        violations.push(`Change Request #${cr.id} reviewed before submission`);
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked
      }
    };
  }

  private async checkRequiredFields(): Promise<InvariantResult> {
    const startTime = Date.now();
    const violations: string[] = [];
    let recordsChecked = 0;
    
    // Check components
    const componentsWithMissing = await this.db.select()
      .from(components)
      .where(sql`${components.name} IS NULL OR ${components.category} IS NULL`);
    
    recordsChecked += componentsWithMissing.length;
    for (const comp of componentsWithMissing) {
      violations.push(`Component '${comp.id}' missing required fields`);
    }
    
    // Check work orders
    const workOrdersWithMissing = await this.db.select()
      .from(workOrders)
      .where(sql`${workOrders.workOrderNo} IS NULL OR ${workOrders.jobTitle} IS NULL`);
    
    recordsChecked += workOrdersWithMissing.length;
    for (const wo of workOrdersWithMissing) {
      violations.push(`Work Order #${wo.id} missing required fields`);
    }
    
    // Check spares
    const sparesWithMissing = await this.db.select()
      .from(spares)
      .where(sql`${spares.partCode} IS NULL OR ${spares.partName} IS NULL`);
    
    recordsChecked += sparesWithMissing.length;
    for (const spare of sparesWithMissing) {
      violations.push(`Spare #${spare.id} missing required fields`);
    }

    return {
      passed: violations.length === 0,
      violations,
      performance: {
        duration: Date.now() - startTime,
        recordsChecked
      }
    };
  }

  async runAllChecks(): Promise<{
    summary: {
      total: number;
      passed: number;
      failed: number;
      warnings: number;
      errors: number;
    };
    results: Array<{
      name: string;
      description: string;
      severity: string;
      passed: boolean;
      violations: string[];
      performance?: any;
    }>;
    totalDuration: number;
  }> {
    const startTime = Date.now();
    const results = [];
    let errors = 0;
    let warnings = 0;
    let passed = 0;
    let failed = 0;

    for (const check of this.checks) {
      try {
        const result = await check.check();
        results.push({
          name: check.name,
          description: check.description,
          severity: check.severity,
          passed: result.passed,
          violations: result.violations,
          performance: result.performance
        });

        if (result.passed) {
          passed++;
        } else {
          failed++;
          if (check.severity === 'error') {
            errors++;
          } else if (check.severity === 'warning') {
            warnings++;
          }
        }
      } catch (error) {
        results.push({
          name: check.name,
          description: check.description,
          severity: 'error',
          passed: false,
          violations: [`Check failed with error: ${error.message}`]
        });
        failed++;
        errors++;
      }
    }

    return {
      summary: {
        total: this.checks.length,
        passed,
        failed,
        warnings,
        errors
      },
      results,
      totalDuration: Date.now() - startTime
    };
  }

  async runCheck(checkName: string): Promise<InvariantResult | null> {
    const check = this.checks.find(c => c.name === checkName);
    if (!check) {
      return null;
    }
    return await check.check();
  }

  getAvailableChecks(): Array<{ name: string; description: string; severity: string }> {
    return this.checks.map(c => ({
      name: c.name,
      description: c.description,
      severity: c.severity
    }));
  }
}