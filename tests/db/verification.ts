import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
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
  formVersionUsage
} from '../../shared/schema';
import { eq, gte, lte, and, sql, ne, isNull, desc, asc } from 'drizzle-orm';

interface VerificationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
  info?: string[];
  performance?: {
    queryTime: number;
    rowCount?: number;
  };
}

interface TableInfo {
  name: string;
  table: any;
  expectedName?: string; // For tables with different display names
}

export class DatabaseVerification {
  private db: any;
  private client: any;
  private performanceMetrics: Map<string, number> = new Map();

  constructor(connectionString?: string) {
    const dbUrl = connectionString || process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }
    this.client = postgres(dbUrl);
    this.db = drizzle(this.client);
  }

  async close(): Promise<void> {
    await this.client.end();
  }

  private async measureQuery<T>(name: string, query: () => Promise<T>): Promise<T> {
    const startTime = Date.now();
    const result = await query();
    const duration = Date.now() - startTime;
    this.performanceMetrics.set(name, duration);
    return result;
  }

  // Table Existence Verification
  async verifyTableExistence(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];
    
    const tables: TableInfo[] = [
      { name: 'components', table: components },
      { name: 'work_orders', table: workOrders },
      { name: 'running_hours_audit', table: runningHoursAudit, expectedName: 'running_hours_log' },
      { name: 'spares', table: spares },
      { name: 'spares_history', table: sparesHistory, expectedName: 'spare_history' },
      { name: 'stores_ledger', table: storesLedger, expectedName: 'store_history' },
      { name: 'change_request', table: changeRequest, expectedName: 'change_requests' },
      { name: 'alert_policies', table: alertPolicies, expectedName: 'alerts' },
      { name: 'alert_events', table: alertEvents },
      { name: 'alert_deliveries', table: alertDeliveries },
      { name: 'alert_config', table: alertConfig },
      { name: 'form_definitions', table: formDefinitions },
      { name: 'form_versions', table: formVersions, expectedName: 'forms_versions' },
      { name: 'form_version_usage', table: formVersionUsage },
      { name: 'change_request_attachment', table: changeRequestAttachment, expectedName: 'attachments' },
      { name: 'change_request_comment', table: changeRequestComment }
    ];
    
    for (const tableInfo of tables) {
      try {
        const result = await this.measureQuery(`check_table_${tableInfo.name}`, async () => {
          return await this.db.select({ count: sql<number>`count(*)` }).from(tableInfo.table);
        });
        
        const count = result[0]?.count || 0;
        const displayName = tableInfo.expectedName || tableInfo.name;
        info.push(`✓ Table '${displayName}' exists with ${count} records`);
      } catch (error) {
        const displayName = tableInfo.expectedName || tableInfo.name;
        errors.push(`✗ Table '${displayName}' does not exist or is inaccessible: ${error.message}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
      performance: {
        queryTime: Array.from(this.performanceMetrics.values()).reduce((a, b) => a + b, 0)
      }
    };
  }

  // Verify no negative ROB values
  async verifyNoNegativeROB(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Check spares
      const negativeSpares = await this.measureQuery('negative_spares_check', async () => {
        return await this.db.select()
          .from(spares)
          .where(sql`${spares.rob} < 0`);
      });
      
      for (const spare of negativeSpares) {
        errors.push(`Spare '${spare.partCode}' (${spare.partName}) has negative ROB: ${spare.rob}`);
      }
      
      // Check stores ledger for negative ROB after transactions
      const negativeStores = await this.measureQuery('negative_stores_check', async () => {
        return await this.db.select()
          .from(storesLedger)
          .where(sql`${storesLedger.robAfterBase} < 0`);
      });
      
      for (const store of negativeStores) {
        errors.push(`Store transaction for '${store.partCode}' resulted in negative ROB: ${store.robAfterBase}`);
      }
    } catch (error) {
      errors.push(`Failed to check negative ROB values: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      performance: {
        queryTime: this.performanceMetrics.get('negative_spares_check') + 
                   this.performanceMetrics.get('negative_stores_check')
      }
    };
  }

  // Verify unique codes enforcement
  async verifyUniqueCodesEnforcement(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Check component codes
      const componentCodes = await this.measureQuery('component_codes_check', async () => {
        return await this.db.execute(sql`
          SELECT component_code, COUNT(*) as count
          FROM ${components}
          WHERE component_code IS NOT NULL
          GROUP BY component_code
          HAVING COUNT(*) > 1
        `);
      });
      
      for (const dup of componentCodes) {
        errors.push(`Duplicate component code '${dup.component_code}' found ${dup.count} times`);
      }
      
      // Check spare codes (componentSpareCode should be unique per vessel)
      const spareCodes = await this.measureQuery('spare_codes_check', async () => {
        return await this.db.execute(sql`
          SELECT vessel_id, component_spare_code, COUNT(*) as count
          FROM ${spares}
          WHERE component_spare_code IS NOT NULL
          GROUP BY vessel_id, component_spare_code
          HAVING COUNT(*) > 1
        `);
      });
      
      for (const dup of spareCodes) {
        errors.push(`Duplicate spare code '${dup.component_spare_code}' found ${dup.count} times in vessel ${dup.vessel_id}`);
      }
      
      // Check stores item codes
      const storesCodes = await this.measureQuery('stores_codes_check', async () => {
        return await this.db.execute(sql`
          SELECT vessel_id, section, part_code, COUNT(DISTINCT item_id) as count
          FROM ${storesLedger}
          GROUP BY vessel_id, section, part_code
          HAVING COUNT(DISTINCT item_id) > 1
        `);
      });
      
      for (const dup of storesCodes) {
        warnings.push(`Part code '${dup.part_code}' used by ${dup.count} different items in ${dup.section}`);
      }
    } catch (error) {
      errors.push(`Failed to check unique codes: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      performance: {
        queryTime: Array.from(this.performanceMetrics.values()).reduce((a, b) => a + b, 0)
      }
    };
  }

  // Verify work order approval records
  async verifyWorkOrderApprovals(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const completedWithoutApproval = await this.measureQuery('wo_approval_check', async () => {
        return await this.db.select()
          .from(workOrders)
          .where(and(
            eq(workOrders.status, 'Completed'),
            isNull(workOrders.approver)
          ));
      });
      
      for (const wo of completedWithoutApproval) {
        errors.push(`Work Order '${wo.workOrderNo}' is Completed but has no approval record`);
      }
      
      // Check for approvals without approval dates
      const approvedWithoutDate = await this.measureQuery('wo_approval_date_check', async () => {
        return await this.db.select()
          .from(workOrders)
          .where(and(
            eq(workOrders.status, 'Completed'),
            sql`${workOrders.approver} IS NOT NULL`,
            isNull(workOrders.approvalDate)
          ));
      });
      
      for (const wo of approvedWithoutDate) {
        warnings.push(`Work Order '${wo.workOrderNo}' has approver but no approval date`);
      }
    } catch (error) {
      errors.push(`Failed to check work order approvals: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      performance: {
        queryTime: this.performanceMetrics.get('wo_approval_check') + 
                   this.performanceMetrics.get('wo_approval_date_check')
      }
    };
  }

  // Verify change request field tracking
  async verifyChangeRequestFieldTracking(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];
    
    try {
      const changeRequests = await this.measureQuery('cr_field_tracking_check', async () => {
        return await this.db.select()
          .from(changeRequest)
          .where(sql`${changeRequest.status} IN ('approved', 'implemented')`);
      });
      
      for (const cr of changeRequests) {
        if (!cr.proposedChangesJson) {
          errors.push(`Change Request #${cr.id} has no proposed changes JSON`);
          continue;
        }
        
        try {
          const changes = typeof cr.proposedChangesJson === 'string' 
            ? JSON.parse(cr.proposedChangesJson) 
            : cr.proposedChangesJson;
          
          if (!Array.isArray(changes)) {
            errors.push(`Change Request #${cr.id} has invalid proposed changes format (not an array)`);
            continue;
          }
          
          for (const change of changes) {
            if (!change.field) {
              warnings.push(`Change Request #${cr.id} has a change without 'field' property`);
            }
            if (change.oldValue === undefined && change.newValue === undefined) {
              warnings.push(`Change Request #${cr.id} has a change without old/new values for field '${change.field}'`);
            }
          }
          
          info.push(`Change Request #${cr.id} tracks ${changes.length} field changes`);
        } catch (parseError) {
          errors.push(`Change Request #${cr.id} has invalid JSON in proposed changes`);
        }
      }
    } catch (error) {
      errors.push(`Failed to check change request field tracking: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
      performance: {
        queryTime: this.performanceMetrics.get('cr_field_tracking_check')
      }
    };
  }

  // Verify meter replacement events
  async verifyMeterReplacementEvents(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];
    
    try {
      const meterReplacements = await this.measureQuery('meter_replacement_check', async () => {
        return await this.db.select()
          .from(runningHoursAudit)
          .where(eq(runningHoursAudit.meterReplaced, true));
      });
      
      for (const event of meterReplacements) {
        // Check if old and new meter values are present
        if (event.oldMeterFinal === null || event.oldMeterFinal === undefined) {
          errors.push(`Meter replacement event #${event.id} missing old meter final reading`);
        }
        if (event.newMeterStart === null || event.newMeterStart === undefined) {
          errors.push(`Meter replacement event #${event.id} missing new meter start reading`);
        }
        
        // Verify component link
        const component = await this.db.select()
          .from(components)
          .where(eq(components.id, event.componentId))
          .limit(1);
        
        if (component.length === 0) {
          errors.push(`Meter replacement event #${event.id} linked to non-existent component '${event.componentId}'`);
        } else {
          info.push(`Meter replacement event #${event.id} properly linked to component '${event.componentId}'`);
        }
      }
      
      if (meterReplacements.length === 0) {
        info.push('No meter replacement events found in the system');
      }
    } catch (error) {
      errors.push(`Failed to check meter replacement events: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
      performance: {
        queryTime: this.performanceMetrics.get('meter_replacement_check')
      }
    };
  }

  // Verify component hierarchy integrity
  async verifyComponentHierarchy(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const allComponents = await this.measureQuery('component_hierarchy_check', async () => {
        return await this.db.select().from(components);
      });
      
      // Check for orphaned components
      for (const comp of allComponents) {
        if (comp.parentId) {
          const parent = allComponents.find(c => c.id === comp.parentId);
          if (!parent) {
            errors.push(`Component '${comp.id}' (${comp.name}) has invalid parent '${comp.parentId}'`);
          }
        }
      }
      
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
            errors.push(`Circular dependency detected: ${id} -> ${child.id}`);
            return true;
          }
        }
        
        recursionStack.delete(id);
        return false;
      };
      
      const roots = allComponents.filter(c => !c.parentId);
      for (const root of roots) {
        if (hasCycle(root.id)) {
          break;
        }
      }
    } catch (error) {
      errors.push(`Database error: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      performance: {
        queryTime: this.performanceMetrics.get('component_hierarchy_check')
      }
    };
  }

  // Verify running hours consistency
  async verifyRunningHoursConsistency(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const allComponents = await this.measureQuery('rh_consistency_components', async () => {
        return await this.db.select().from(components);
      });
      
      for (const comp of allComponents) {
        // Get all audit entries for this component
        const audits = await this.db
          .select()
          .from(runningHoursAudit)
          .where(eq(runningHoursAudit.componentId, comp.id))
          .orderBy(asc(runningHoursAudit.enteredAtUTC));
        
        if (audits.length > 0) {
          const latestAudit = audits[audits.length - 1];
          const componentRH = parseFloat(comp.currentCumulativeRH || '0');
          const auditRH = parseFloat(latestAudit.cumulativeRH || '0');
          
          if (Math.abs(componentRH - auditRH) > 0.01) {
            errors.push(
              `Component '${comp.id}' RH mismatch: component=${componentRH}, latest audit=${auditRH}`
            );
          }
          
          // Check for negative running hours
          for (const audit of audits) {
            if (parseFloat(audit.newRH) < 0) {
              errors.push(`Negative RH delta in audit #${audit.id} for component '${comp.id}'`);
            }
            if (parseFloat(audit.cumulativeRH) < 0) {
              errors.push(`Negative cumulative RH in audit #${audit.id} for component '${comp.id}'`);
            }
          }
          
          // Check for chronological consistency
          let prevCumulative = 0;
          for (const audit of audits) {
            const cumulative = parseFloat(audit.cumulativeRH);
            if (cumulative < prevCumulative && !audit.meterReplaced) {
              errors.push(
                `Running hours decreased for component '${comp.id}': ${prevCumulative} -> ${cumulative} (no meter replacement)`
              );
            }
            prevCumulative = cumulative;
          }
        }
      }
    } catch (error) {
      errors.push(`Database error: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      performance: {
        queryTime: this.performanceMetrics.get('rh_consistency_components')
      }
    };
  }

  // Verify spare consumption history
  async verifySparesConsumptionHistory(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const info: string[] = [];
    
    try {
      const allSpares = await this.measureQuery('spares_history_check', async () => {
        return await this.db.select().from(spares);
      });
      
      for (const spare of allSpares) {
        // Get history for this spare
        const history = await this.db
          .select()
          .from(sparesHistory)
          .where(eq(sparesHistory.spareId, spare.id))
          .orderBy(asc(sparesHistory.timestampUTC));
        
        if (history.length > 0) {
          // Calculate expected ROB from history
          let calculatedROB = 0;
          for (const event of history) {
            calculatedROB += event.qtyChange;
          }
          
          // Check if final ROB in history matches current ROB
          const lastEvent = history[history.length - 1];
          if (lastEvent.robAfter !== spare.rob) {
            warnings.push(
              `Spare '${spare.partCode}' ROB mismatch: current=${spare.rob}, last history=${lastEvent.robAfter}`
            );
          }
          
          // Verify each history event has proper data
          for (const event of history) {
            if (!event.userId) {
              warnings.push(`Spare history event #${event.id} missing userId`);
            }
            if (!event.timestampUTC) {
              errors.push(`Spare history event #${event.id} missing timestamp`);
            }
          }
        } else {
          info.push(`Spare '${spare.partCode}' has no history records`);
        }
      }
    } catch (error) {
      errors.push(`Failed to verify spares consumption history: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      info,
      performance: {
        queryTime: this.performanceMetrics.get('spares_history_check')
      }
    };
  }

  // Verify status transitions
  async verifyStatusTransitions(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Work Order status validation
      const validWOStatuses = ['Completed', 'Due', 'Due (Grace P)', 'Overdue', 'Postponed', 'Pending Approval'];
      const workOrdersInvalid = await this.measureQuery('wo_status_check', async () => {
        return await this.db.select()
          .from(workOrders)
          .where(sql`${workOrders.status} NOT IN (${sql.join(validWOStatuses.map(s => sql.lit(s)), sql`, `)})`);
      });
      
      for (const wo of workOrdersInvalid) {
        errors.push(`Work Order '${wo.workOrderNo}' has invalid status: '${wo.status}'`);
      }
      
      // Change Request status validation
      const validCRStatuses = ['draft', 'submitted', 'returned', 'approved', 'rejected'];
      const changeRequestsInvalid = await this.measureQuery('cr_status_check', async () => {
        return await this.db.select()
          .from(changeRequest)
          .where(sql`${changeRequest.status} NOT IN (${sql.join(validCRStatuses.map(s => sql.lit(s)), sql`, `)})`);
      });
      
      for (const cr of changeRequestsInvalid) {
        errors.push(`Change Request #${cr.id} has invalid status: '${cr.status}'`);
      }
      
      // Alert Delivery status validation
      const validDeliveryStatuses = ['pending', 'sent', 'failed', 'acknowledged'];
      const deliveriesInvalid = await this.measureQuery('delivery_status_check', async () => {
        return await this.db.select()
          .from(alertDeliveries)
          .where(sql`${alertDeliveries.status} NOT IN (${sql.join(validDeliveryStatuses.map(s => sql.lit(s)), sql`, `)})`);
      });
      
      for (const delivery of deliveriesInvalid) {
        errors.push(`Alert Delivery #${delivery.id} has invalid status: '${delivery.status}'`);
      }
    } catch (error) {
      errors.push(`Failed to verify status transitions: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      performance: {
        queryTime: this.performanceMetrics.get('wo_status_check') + 
                   this.performanceMetrics.get('cr_status_check') +
                   this.performanceMetrics.get('delivery_status_check')
      }
    };
  }

  // Verify audit trails
  async verifyAuditTrails(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Check running hours audit
      const rhAuditMissing = await this.measureQuery('rh_audit_check', async () => {
        return await this.db.select()
          .from(runningHoursAudit)
          .where(sql`${runningHoursAudit.userId} IS NULL OR ${runningHoursAudit.enteredAtUTC} IS NULL`);
      });
      
      for (const audit of rhAuditMissing) {
        errors.push(`Running Hours Audit #${audit.id} missing user or timestamp`);
      }
      
      // Check spares history
      const sparesHistoryMissing = await this.measureQuery('spares_audit_check', async () => {
        return await this.db.select()
          .from(sparesHistory)
          .where(sql`${sparesHistory.userId} IS NULL OR ${sparesHistory.timestampUTC} IS NULL`);
      });
      
      for (const history of sparesHistoryMissing) {
        errors.push(`Spares History #${history.id} missing user or timestamp`);
      }
      
      // Check stores ledger
      const storesLedgerMissing = await this.measureQuery('stores_audit_check', async () => {
        return await this.db.select()
          .from(storesLedger)
          .where(sql`${storesLedger.userId} IS NULL OR ${storesLedger.timestampUTC} IS NULL`);
      });
      
      for (const ledger of storesLedgerMissing) {
        errors.push(`Stores Ledger #${ledger.id} missing user or timestamp`);
      }
    } catch (error) {
      errors.push(`Failed to verify audit trails: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      performance: {
        queryTime: this.performanceMetrics.get('rh_audit_check') + 
                   this.performanceMetrics.get('spares_audit_check') +
                   this.performanceMetrics.get('stores_audit_check')
      }
    };
  }

  // Verify orphan records
  async verifyNoOrphanRecords(): Promise<VerificationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Get all component IDs for reference
      const componentIds = await this.measureQuery('get_component_ids', async () => {
        const comps = await this.db.select({ id: components.id }).from(components);
        return new Set(comps.map(c => c.id));
      });
      
      // Check work orders reference valid components
      const orphanWorkOrders = await this.measureQuery('orphan_wo_check', async () => {
        return await this.db.select()
          .from(workOrders);
      });
      
      for (const wo of orphanWorkOrders) {
        if (wo.componentCode && !componentIds.has(wo.componentCode)) {
          warnings.push(`Work Order '${wo.workOrderNo}' references non-existent component code '${wo.componentCode}'`);
        }
      }
      
      // Check spares reference valid components
      const orphanSpares = await this.measureQuery('orphan_spares_check', async () => {
        return await this.db.select()
          .from(spares);
      });
      
      for (const spare of orphanSpares) {
        if (!componentIds.has(spare.componentId)) {
          errors.push(`Spare '${spare.partCode}' references non-existent component '${spare.componentId}'`);
        }
      }
      
      // Check running hours audit references valid components
      const orphanRHAudits = await this.measureQuery('orphan_rh_check', async () => {
        return await this.db.select()
          .from(runningHoursAudit);
      });
      
      for (const audit of orphanRHAudits) {
        if (!componentIds.has(audit.componentId)) {
          errors.push(`Running Hours Audit #${audit.id} references non-existent component '${audit.componentId}'`);
        }
      }
    } catch (error) {
      errors.push(`Failed to check orphan records: ${error.message}`);
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      performance: {
        queryTime: Array.from(this.performanceMetrics.values()).reduce((a, b) => a + b, 0)
      }
    };
  }

  // Get table row counts
  async getTableRowCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    
    const tables = [
      { name: 'components', table: components },
      { name: 'work_orders', table: workOrders },
      { name: 'running_hours_audit', table: runningHoursAudit },
      { name: 'spares', table: spares },
      { name: 'spares_history', table: sparesHistory },
      { name: 'stores_ledger', table: storesLedger },
      { name: 'change_request', table: changeRequest },
      { name: 'alert_policies', table: alertPolicies },
      { name: 'alert_events', table: alertEvents },
      { name: 'form_definitions', table: formDefinitions },
      { name: 'form_versions', table: formVersions }
    ];
    
    for (const { name, table } of tables) {
      try {
        const result = await this.db.select({ count: sql<number>`count(*)` }).from(table);
        counts[name] = result[0]?.count || 0;
      } catch (error) {
        counts[name] = -1; // Indicate error
      }
    }
    
    return counts;
  }

  // Run all verifications
  async runAllVerifications(): Promise<{ 
    valid: boolean; 
    results: Record<string, VerificationResult>;
    rowCounts: Record<string, number>;
    totalQueryTime: number;
  }> {
    this.performanceMetrics.clear();
    
    const results = {
      tableExistence: await this.verifyTableExistence(),
      noNegativeROB: await this.verifyNoNegativeROB(),
      uniqueCodes: await this.verifyUniqueCodesEnforcement(),
      workOrderApprovals: await this.verifyWorkOrderApprovals(),
      changeRequestFields: await this.verifyChangeRequestFieldTracking(),
      meterReplacements: await this.verifyMeterReplacementEvents(),
      componentHierarchy: await this.verifyComponentHierarchy(),
      runningHours: await this.verifyRunningHoursConsistency(),
      sparesHistory: await this.verifySparesConsumptionHistory(),
      statusTransitions: await this.verifyStatusTransitions(),
      auditTrails: await this.verifyAuditTrails(),
      orphanRecords: await this.verifyNoOrphanRecords()
    };
    
    const rowCounts = await this.getTableRowCounts();
    const allValid = Object.values(results).every(r => r.valid);
    const totalQueryTime = Array.from(this.performanceMetrics.values()).reduce((a, b) => a + b, 0);
    
    return {
      valid: allValid,
      results,
      rowCounts,
      totalQueryTime
    };
  }

  // Export sample data
  async exportSampleData(limit: number = 10): Promise<Record<string, any[]>> {
    const samples: Record<string, any[]> = {};
    
    try {
      samples.components = await this.db.select().from(components).limit(limit);
      samples.workOrders = await this.db.select().from(workOrders).limit(limit);
      samples.spares = await this.db.select().from(spares).limit(limit);
      samples.runningHoursAudit = await this.db.select().from(runningHoursAudit).limit(limit);
      samples.sparesHistory = await this.db.select().from(sparesHistory).limit(limit);
      samples.storesLedger = await this.db.select().from(storesLedger).limit(limit);
      samples.changeRequest = await this.db.select().from(changeRequest).limit(limit);
    } catch (error) {
      console.error('Error exporting sample data:', error);
    }
    
    return samples;
  }

  // Cleanup test data
  async cleanupTestData(prefix: string = 'test_'): Promise<void> {
    try {
      // Clean up test components
      await this.db.delete(components).where(sql`id LIKE ${prefix + '%'}`);
      
      // Clean up test work orders
      await this.db.delete(workOrders).where(sql`id LIKE ${prefix + '%'}`);
      
      // Clean up test spares
      await this.db.delete(spares).where(sql`part_code LIKE ${prefix + '%'}`);
      
      // Clean up test change requests
      await this.db.delete(changeRequest).where(sql`id LIKE ${prefix + '%'}`);
    } catch (error) {
      console.error('Error cleaning up test data:', error);
      throw error;
    }
  }
}