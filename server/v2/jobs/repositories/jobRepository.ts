import { getDb } from '../../../db';
import { v2Jobs, v2JobComponentLinks, v2Components, v2ComponentMaintenanceHistory, v2Spares } from '@shared/v2/jobs/schema';
import { v2WorkOrders } from '@shared/v2/work-orders/schema';
import type { Job, InsertJob, JobComponentLink } from '@shared/v2/jobs/schema';
import type { WorkOrder } from '@shared/v2/work-orders/schema';
import { eq, and, sql, inArray, like, desc, asc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export class JobRepository {
  async findJobs(vesselId?: string, componentId?: string): Promise<Job[]> {
    const db = await getDb();
    if (vesselId && componentId) {
      return db.select().from(v2Jobs).where(and(eq(v2Jobs.vesselId, vesselId), eq(v2Jobs.componentId, componentId)));
    }
    if (vesselId) {
      return db.select().from(v2Jobs).where(eq(v2Jobs.vesselId, vesselId));
    }
    if (componentId) {
      return db.select().from(v2Jobs).where(eq(v2Jobs.componentId, componentId));
    }
    return db.select().from(v2Jobs);
  }

  async findById(id: string): Promise<Job | undefined> {
    const db = await getDb();
    const [job] = await db.select().from(v2Jobs).where(eq(v2Jobs.id, id));
    return job;
  }

  async create(data: InsertJob): Promise<Job> {
    const db = await getDb();
    const id = data.id || uuidv4();
    const [job] = await db.insert(v2Jobs).values({ ...data, id }).returning();
    return job;
  }

  async update(id: string, data: Partial<InsertJob>): Promise<Job> {
    const db = await getDb();
    const [job] = await db.update(v2Jobs).set({ ...data, updatedAt: new Date() }).where(eq(v2Jobs.id, id)).returning();
    if (!job) throw new Error('Job not found');
    return job;
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(v2Jobs).where(eq(v2Jobs.id, id));
  }

  async findLinksByVessel(vesselId: string): Promise<JobComponentLink[]> {
    const db = await getDb();
    return db.select().from(v2JobComponentLinks).where(eq(v2JobComponentLinks.vesselId, vesselId));
  }

  async findLinksByJob(jobId: string): Promise<JobComponentLink[]> {
    const db = await getDb();
    return db.select().from(v2JobComponentLinks).where(eq(v2JobComponentLinks.jobId, jobId));
  }

  async findLinksByComponent(componentId: string): Promise<JobComponentLink[]> {
    const db = await getDb();
    return db.select().from(v2JobComponentLinks).where(eq(v2JobComponentLinks.componentId, componentId));
  }

  async findComponentById(id: string) {
    const db = await getDb();
    const [comp] = await db.select().from(v2Components).where(eq(v2Components.id, id));
    return comp;
  }

  async findComponentByCode(code: string, vesselId: string) {
    const db = await getDb();
    const [comp] = await db.select().from(v2Components).where(
      and(eq(v2Components.componentCode, code), eq(v2Components.vesselId, vesselId))
    );
    return comp;
  }

  async findWorkOrdersByJobId(jobId: string): Promise<WorkOrder[]> {
    const db = await getDb();
    return db.select().from(v2WorkOrders).where(eq(v2WorkOrders.jobId, jobId));
  }

  async findHistoryByJobId(jobId: string) {
    const db = await getDb();
    return db.select().from(v2ComponentMaintenanceHistory).where(eq(v2ComponentMaintenanceHistory.jobId, jobId));
  }

  async findHistoryByJobNo(jobNo: string) {
    const db = await getDb();
    return db.select().from(v2ComponentMaintenanceHistory).where(eq(v2ComponentMaintenanceHistory.jobCode, jobNo));
  }

  async findSpareInventoryByCodes(vesselId: string, partCodes: string[]): Promise<Map<string, any>> {
    if (!partCodes.length) return new Map();
    const db = await getDb();
    const results = await db.select().from(v2Spares).where(
      and(
        eq(v2Spares.vesselId, vesselId),
        inArray(v2Spares.partCode, partCodes),
        eq(v2Spares.deleted, false)
      )
    );
    const map = new Map();
    for (const r of results) {
      map.set(r.partCode, { rob: r.rob, robLocationA: r.robLocationA, robLocationB: r.robLocationB });
    }
    return map;
  }

  async findSpareInventoryByNumbers(vesselId: string, partNumbers: string[]): Promise<Map<string, any>> {
    if (!partNumbers.length) return new Map();
    const db = await getDb();
    const results = await db.select().from(v2Spares).where(
      and(
        eq(v2Spares.vesselId, vesselId),
        inArray(v2Spares.partNumber, partNumbers),
        eq(v2Spares.deleted, false)
      )
    );
    const map = new Map();
    for (const r of results) {
      if (r.partNumber) map.set(r.partNumber, { rob: r.rob, robLocationA: r.robLocationA, robLocationB: r.robLocationB });
    }
    return map;
  }

  async findMaxJobNumber(prefix: string = 'JOB'): Promise<string | null> {
    const db = await getDb();
    const result = await db.execute(
      sql`SELECT job_no FROM jobs WHERE job_no LIKE ${prefix + '-%'} ORDER BY job_no DESC LIMIT 1`
    );
    if (result.rows && result.rows.length > 0) {
      return (result.rows[0] as any).job_no;
    }
    return null;
  }
}
