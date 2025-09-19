import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { 
  components, 
  workOrders, 
  spares, 
  runningHoursAudit, 
  changeRequest 
} from '../../shared/schema';
import { eq, gte, lte, and, sql } from 'drizzle-orm';

export class DatabaseVerification {
  private db: any;
  private client: any;

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

  // Verify component hierarchy integrity
  async verifyComponentHierarchy(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const allComponents = await this.db.select().from(components);
      
      // Check for orphaned components
      for (const comp of allComponents) {
        if (comp.parentId) {
          const parent = allComponents.find(c => c.id === comp.parentId);
          if (!parent) {
            errors.push(`Component ${comp.id} has invalid parent ${comp.parentId}`);
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
      errors.push(`Database error: ${error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Verify running hours consistency
  async verifyRunningHoursConsistency(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const allComponents = await this.db.select().from(components);
      
      for (const comp of allComponents) {
        // Get all audit entries for this component
        const audits = await this.db
          .select()
          .from(runningHoursAudit)
          .where(eq(runningHoursAudit.componentId, comp.id))
          .orderBy(runningHoursAudit.enteredAtUTC);
        
        if (audits.length > 0) {
          const latestAudit = audits[audits.length - 1];
          const componentRH = parseFloat(comp.currentCumulativeRH || '0');
          const auditRH = parseFloat(latestAudit.cumulativeRH || '0');
          
          if (Math.abs(componentRH - auditRH) > 0.01) {
            errors.push(
              `Component ${comp.id} RH mismatch: component=${componentRH}, audit=${auditRH}`
            );
          }
          
          // Check for negative running hours
          for (const audit of audits) {
            if (parseFloat(audit.newRH) < 0) {
              errors.push(`Negative RH delta in audit ${audit.id} for component ${comp.id}`);
            }
            if (parseFloat(audit.cumulativeRH) < 0) {
              errors.push(`Negative cumulative RH in audit ${audit.id} for component ${comp.id}`);
            }
          }
          
          // Check for chronological consistency
          let prevCumulative = 0;
          for (const audit of audits) {
            const cumulative = parseFloat(audit.cumulativeRH);
            if (cumulative < prevCumulative) {
              errors.push(
                `Running hours decreased for component ${comp.id}: ${prevCumulative} -> ${cumulative}`
              );
            }
            prevCumulative = cumulative;
          }
        }
      }
    } catch (error) {
      errors.push(`Database error: ${error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Verify spare parts inventory consistency
  async verifySparesInventory(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const allSpares = await this.db.select().from(spares);
      
      for (const spare of allSpares) {
        // Check for negative quantities
        if (spare.rob < 0) {
          errors.push(`Spare ${spare.partCode} has negative ROB: ${spare.rob}`);
        }
        
        if (spare.min < 0) {
          errors.push(`Spare ${spare.partCode} has negative minimum: ${spare.min}`);
        }
        
        // Verify stock status consistency
        const expectedStatus = spare.rob === 0 ? 'Out' : spare.rob < spare.min ? 'Low' : 'OK';
        if (spare.stock !== expectedStatus) {
          errors.push(
            `Spare ${spare.partCode} stock status mismatch: expected=${expectedStatus}, actual=${spare.stock}`
          );
        }
      }
    } catch (error) {
      errors.push(`Database error: ${error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Verify work order status consistency
  async verifyWorkOrderStatus(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const allWorkOrders = await this.db.select().from(workOrders);
      const today = new Date();
      
      for (const wo of allWorkOrders) {
        if (wo.dueDate) {
          const dueDate = new Date(wo.dueDate);
          const isOverdue = dueDate < today && wo.status === 'Pending';
          
          if (isOverdue && wo.status !== 'Overdue') {
            errors.push(`Work order ${wo.id} should be marked as Overdue`);
          }
        }
        
        // Check for completed work orders with future completion dates
        if (wo.status === 'Completed' && wo.completedDate) {
          const completedDate = new Date(wo.completedDate);
          if (completedDate > today) {
            errors.push(`Work order ${wo.id} has future completion date`);
          }
        }
      }
    } catch (error) {
      errors.push(`Database error: ${error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Verify change request workflow integrity
  async verifyChangeRequestIntegrity(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const allChangeRequests = await this.db.select().from(changeRequest);
      
      for (const cr of allChangeRequests) {
        // Check status transitions
        const validStatuses = ['draft', 'submitted', 'approved', 'rejected', 'implemented'];
        if (!validStatuses.includes(cr.status)) {
          errors.push(`Change request ${cr.id} has invalid status: ${cr.status}`);
        }
        
        // Check that implemented requests have approval
        if (cr.status === 'implemented' && !cr.approvedBy) {
          errors.push(`Change request ${cr.id} is implemented but not approved`);
        }
        
        // Check that rejected requests have rejection reason
        if (cr.status === 'rejected' && !cr.rejectionReason) {
          errors.push(`Change request ${cr.id} is rejected without reason`);
        }
      }
    } catch (error) {
      errors.push(`Database error: ${error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Run all verifications
  async runAllVerifications(): Promise<{ 
    valid: boolean; 
    results: Record<string, { valid: boolean; errors: string[] }> 
  }> {
    const results = {
      componentHierarchy: await this.verifyComponentHierarchy(),
      runningHours: await this.verifyRunningHoursConsistency(),
      sparesInventory: await this.verifySparesInventory(),
      workOrderStatus: await this.verifyWorkOrderStatus(),
      changeRequests: await this.verifyChangeRequestIntegrity(),
    };
    
    const allValid = Object.values(results).every(r => r.valid);
    
    return {
      valid: allValid,
      results
    };
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