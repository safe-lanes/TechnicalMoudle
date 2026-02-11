import { eq, and, desc, inArray, or } from 'drizzle-orm';
import crypto from 'crypto';
import { getDb } from '../../../db';
import {
  v2Components,
  v2ComponentDocuments,
  v2ComponentClassRegulatory,
  v2ComponentMaintenanceHistory,
  v2ComponentRequisitions,
  v2Jobs,
  v2JobComponentLinks,
} from '@shared/v2/components/schema';
import type {
  Component,
  InsertComponent,
  ComponentDocument,
  InsertComponentDocument,
  ComponentClassRegulatory,
  InsertComponentClassRegulatory,
  ComponentMaintenanceHistory,
  ComponentRequisition,
  InsertComponentRequisition,
} from '@shared/v2/components/schema';

export class ComponentRepository {
  async findByVesselId(vesselId: string): Promise<Component[]> {
    const db = await getDb();
    return await db.select().from(v2Components)
      .where(and(
        eq(v2Components.vesselId, vesselId),
        eq(v2Components.dataScope, 'vessel')
      ));
  }

  async findById(id: string): Promise<Component | undefined> {
    const db = await getDb();
    const result = await db.select().from(v2Components).where(eq(v2Components.id, id));
    return result[0];
  }

  async findByCode(code: string, vesselId: string): Promise<Component | undefined> {
    const db = await getDb();
    const result = await db.select().from(v2Components)
      .where(and(
        eq(v2Components.componentCode, code),
        eq(v2Components.vesselId, vesselId)
      ));
    return result[0];
  }

  async create(data: InsertComponent): Promise<Component> {
    const db = await getDb();
    const id = (data as any).id || `COMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const cuuid = (data as any).cuuid || crypto.randomUUID();
    const result = await db.insert(v2Components).values({
      ...data,
      id,
      cuuid,
      dataScope: data.dataScope || 'vessel',
    } as any).returning();
    return result[0];
  }

  async update(id: string, data: Partial<Component>): Promise<Component> {
    const db = await getDb();
    const result = await db.update(v2Components)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(v2Components.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Component ${id} not found`);
    }
    return result[0];
  }

  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(v2Components).where(eq(v2Components.id, id));
  }

  async inactivate(id: string, userId: string, options?: { cascadeInactivate?: boolean }): Promise<{
    success: boolean;
    message: string;
    componentsInactivated: number;
    jobsInactivated: number;
    activeChildrenCount?: number;
  }> {
    const db = await getDb();

    const componentResult = await db.select().from(v2Components)
      .where(eq(v2Components.id, id))
      .limit(1);

    if (componentResult.length === 0) {
      return {
        success: false,
        message: `Component not found: ${id}`,
        componentsInactivated: 0,
        jobsInactivated: 0,
      };
    }

    const activeChildren = await db.select().from(v2Components)
      .where(and(
        eq(v2Components.parentId, id),
        eq(v2Components.isActive, true)
      ));

    if (!options?.cascadeInactivate && activeChildren.length > 0) {
      return {
        success: false,
        message: `Component has ${activeChildren.length} active children. Set cascadeInactivate to true to inactivate them all.`,
        componentsInactivated: 0,
        jobsInactivated: 0,
        activeChildrenCount: activeChildren.length,
      };
    }

    let componentsInactivated = 0;
    let jobsInactivated = 0;

    if (options?.cascadeInactivate && activeChildren.length > 0) {
      const childIds = activeChildren.map(c => c.id);
      await db.update(v2Components)
        .set({ isActive: false })
        .where(inArray(v2Components.id, childIds));
      componentsInactivated += childIds.length;

      const childJobIdsToInactivate = new Set<string>();

      for (const childId of childIds) {
        const directJobs = await db.select().from(v2Jobs)
          .where(eq(v2Jobs.componentId, childId));
        for (const job of directJobs) {
          childJobIdsToInactivate.add(job.id);
        }
        const linkedJobs = await db.select().from(v2JobComponentLinks)
          .where(eq(v2JobComponentLinks.componentId, childId));
        for (const link of linkedJobs) {
          childJobIdsToInactivate.add(link.jobId);
        }
      }

      const childJobIds = Array.from(childJobIdsToInactivate);
      for (const jobId of childJobIds) {
        await db.update(v2Jobs)
          .set({ isActive: false })
          .where(eq(v2Jobs.id, jobId));
      }
      jobsInactivated += childJobIdsToInactivate.size;
    }

    await db.update(v2Components)
      .set({ isActive: false })
      .where(eq(v2Components.id, id));
    componentsInactivated++;

    const mainJobIdsToInactivate = new Set<string>();

    const directJobs = await db.select().from(v2Jobs)
      .where(eq(v2Jobs.componentId, id));
    for (const job of directJobs) {
      mainJobIdsToInactivate.add(job.id);
    }
    const linkedJobs = await db.select().from(v2JobComponentLinks)
      .where(eq(v2JobComponentLinks.componentId, id));
    for (const link of linkedJobs) {
      mainJobIdsToInactivate.add(link.jobId);
    }

    const mainJobIds = Array.from(mainJobIdsToInactivate);
    for (const jobId of mainJobIds) {
      await db.update(v2Jobs)
        .set({ isActive: false })
        .where(eq(v2Jobs.id, jobId));
    }
    jobsInactivated += mainJobIdsToInactivate.size;

    return {
      success: true,
      message: `Component and ${componentsInactivated - 1} children inactivated, along with ${jobsInactivated} linked jobs.`,
      componentsInactivated,
      jobsInactivated,
    };
  }

  async bulkUpsert(componentsData: any[]): Promise<{ created: number; updated: number }> {
    const db = await getDb();
    let created = 0;
    let updated = 0;

    for (const comp of componentsData) {
      const existing = await db.select().from(v2Components)
        .where(eq(v2Components.id, comp.id))
        .limit(1);

      if (existing.length > 0) {
        await db.update(v2Components)
          .set(comp)
          .where(eq(v2Components.id, comp.id));
        updated++;
      } else {
        await db.insert(v2Components).values(comp);
        created++;
      }
    }

    return { created, updated };
  }

  async setRunningHours(params: {
    componentId: string;
    newRHValue: number;
    updateSource: string;
    userId: string;
    lastUpdatedDate?: string;
  }): Promise<{ component: Component; inheritedUpdated: number }> {
    const db = await getDb();
    const now = new Date();
    const lastUpdatedValue = params.lastUpdatedDate || now.toISOString();

    const component = await this.findById(params.componentId);
    if (!component) {
      throw new Error(`Component ${params.componentId} not found`);
    }

    const rhValueStr = params.newRHValue.toString();
    let inheritedUpdated = 0;

    if (component.rhCounterType === 'MASTER') {
      const previousMasterRH = parseFloat(component.rhCurrentMaster || component.currentCumulativeRH || '0');
      const delta = params.newRHValue - previousMasterRH;

      const result = await db.update(v2Components)
        .set({
          rhCurrentMaster: rhValueStr,
          currentCumulativeRH: rhValueStr,
          rhMasterUpdatedAt: now,
          rhMasterUpdatedBy: params.userId,
          rhMasterUpdateSource: params.updateSource,
          lastUpdated: lastUpdatedValue,
          updatedAt: now,
        })
        .where(eq(v2Components.id, params.componentId))
        .returning();

      if (!result[0]) {
        throw new Error(`Failed to update MASTER component ${params.componentId}`);
      }

      const masterVesselId = component.vesselId;

      if (!masterVesselId) {
        console.warn(`⚠️ [V2 setRunningHours] Cannot determine vesselId for master "${params.componentId}" - skipping cascade to prevent cross-vessel leak`);
        return { component: result[0], inheritedUpdated: 0 };
      }

      const inheritedComponents = await this.getInheritedComponents(params.componentId, masterVesselId);

      for (const inherited of inheritedComponents) {
        const currentChildRH = parseFloat(inherited.currentCumulativeRH || inherited.rhCurrentInheritedCached || '0');
        const newChildRH = Math.max(0, currentChildRH + delta);

        await db.update(v2Components)
          .set({
            rhCurrentInheritedCached: params.newRHValue.toString(),
            currentCumulativeRH: newChildRH.toString(),
            rhInheritedUpdatedAt: now,
            lastUpdated: lastUpdatedValue,
            updatedAt: now,
          })
          .where(eq(v2Components.id, inherited.id));

        inheritedUpdated++;
      }

      return { component: result[0], inheritedUpdated };

    } else if (component.rhCounterType === 'INHERITED') {
      const result = await db.update(v2Components)
        .set({
          currentCumulativeRH: rhValueStr,
          rhInheritedUpdatedAt: now,
          lastUpdated: lastUpdatedValue,
          updatedAt: now,
        })
        .where(eq(v2Components.id, params.componentId))
        .returning();

      if (!result[0]) {
        throw new Error(`Failed to update INHERITED component ${params.componentId}`);
      }
      return { component: result[0], inheritedUpdated: 0 };

    } else {
      const result = await db.update(v2Components)
        .set({
          currentCumulativeRH: rhValueStr,
          lastUpdated: lastUpdatedValue,
          updatedAt: now,
        })
        .where(eq(v2Components.id, params.componentId))
        .returning();

      if (!result[0]) {
        throw new Error(`Failed to update component ${params.componentId}`);
      }
      return { component: result[0], inheritedUpdated: 0 };
    }
  }

  async getInheritedComponents(masterComponentId: string, vesselId?: string): Promise<Component[]> {
    const db = await getDb();

    let masterComponent = await this.findById(masterComponentId);

    if (!masterComponent) {
      const byCode = await db.select().from(v2Components)
        .where(eq(v2Components.componentCode, masterComponentId))
        .limit(1);
      masterComponent = byCode[0] || null;
    }

    const masterComponentCode = masterComponent?.componentCode || masterComponentId;
    const masterComponentFullId = masterComponent?.id || masterComponentId;
    const effectiveVesselId = vesselId || masterComponent?.vesselId;

    if (!effectiveVesselId) {
      console.warn(`⚠️ [V2 getInheritedComponents] Cannot determine vesselId for master "${masterComponentId}" - returning empty to prevent cross-vessel leak`);
      return [];
    }

    return await db.select().from(v2Components)
      .where(and(
        eq(v2Components.rhCounterType, 'INHERITED'),
        eq(v2Components.vesselId, effectiveVesselId),
        or(
          eq(v2Components.rhMasterComponentId, masterComponentFullId),
          eq(v2Components.rhMasterComponentId, masterComponentCode),
          eq(v2Components.rhMasterComponentId, masterComponentId),
          eq(v2Components.rhCounterSource, masterComponentCode)
        )
      ));
  }

  async findDocuments(componentId: string): Promise<ComponentDocument[]> {
    const db = await getDb();
    return await db.select().from(v2ComponentDocuments)
      .where(eq(v2ComponentDocuments.componentId, componentId));
  }

  async findDocument(id: number): Promise<ComponentDocument | undefined> {
    const db = await getDb();
    const result = await db.select().from(v2ComponentDocuments)
      .where(eq(v2ComponentDocuments.id, id));
    return result[0];
  }

  async createDocument(doc: InsertComponentDocument): Promise<ComponentDocument> {
    const db = await getDb();
    const result = await db.insert(v2ComponentDocuments).values(doc).returning();
    return result[0];
  }

  async updateDocument(id: number, data: Partial<ComponentDocument>): Promise<ComponentDocument> {
    const db = await getDb();
    const result = await db.update(v2ComponentDocuments)
      .set(data)
      .where(eq(v2ComponentDocuments.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Component document ${id} not found`);
    }
    return result[0];
  }

  async removeDocument(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(v2ComponentDocuments).where(eq(v2ComponentDocuments.id, id));
  }

  async findClassRegulatory(componentId: string): Promise<ComponentClassRegulatory[]> {
    const db = await getDb();
    return await db.select().from(v2ComponentClassRegulatory)
      .where(eq(v2ComponentClassRegulatory.componentId, componentId));
  }

  async createClassRegulatory(data: InsertComponentClassRegulatory): Promise<ComponentClassRegulatory> {
    const db = await getDb();
    const result = await db.insert(v2ComponentClassRegulatory).values(data).returning();
    return result[0];
  }

  async updateClassRegulatory(id: number, data: Partial<ComponentClassRegulatory>): Promise<ComponentClassRegulatory> {
    const db = await getDb();
    const result = await db.update(v2ComponentClassRegulatory)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(v2ComponentClassRegulatory.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Component class regulatory ${id} not found`);
    }
    return result[0];
  }

  async removeClassRegulatory(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(v2ComponentClassRegulatory).where(eq(v2ComponentClassRegulatory.id, id));
  }

  async findRequisitions(componentId: string): Promise<ComponentRequisition[]> {
    const db = await getDb();
    return await db.select().from(v2ComponentRequisitions)
      .where(eq(v2ComponentRequisitions.componentId, componentId))
      .orderBy(desc(v2ComponentRequisitions.createdAt));
  }

  async findAllRequisitions(vesselCode?: string): Promise<ComponentRequisition[]> {
    const db = await getDb();
    if (vesselCode) {
      return await db.select().from(v2ComponentRequisitions)
        .where(eq(v2ComponentRequisitions.vesselCode, vesselCode))
        .orderBy(desc(v2ComponentRequisitions.createdAt));
    }
    return await db.select().from(v2ComponentRequisitions)
      .orderBy(desc(v2ComponentRequisitions.createdAt));
  }

  async findRequisitionItem(id: number): Promise<ComponentRequisition | undefined> {
    const db = await getDb();
    const result = await db.select().from(v2ComponentRequisitions)
      .where(eq(v2ComponentRequisitions.id, id));
    return result[0];
  }

  async createRequisition(data: InsertComponentRequisition): Promise<ComponentRequisition> {
    const db = await getDb();
    const result = await db.insert(v2ComponentRequisitions).values(data).returning();
    return result[0];
  }

  async updateRequisition(id: number, data: Partial<ComponentRequisition>): Promise<ComponentRequisition> {
    const db = await getDb();
    const result = await db.update(v2ComponentRequisitions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(v2ComponentRequisitions.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Component requisition ${id} not found`);
    }
    return result[0];
  }

  async removeRequisition(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(v2ComponentRequisitions).where(eq(v2ComponentRequisitions.id, id));
  }

  async findMaintenanceHistory(componentId: string): Promise<ComponentMaintenanceHistory[]> {
    const db = await getDb();
    return await db.select().from(v2ComponentMaintenanceHistory)
      .where(eq(v2ComponentMaintenanceHistory.componentId, componentId))
      .orderBy(desc(v2ComponentMaintenanceHistory.dateCompleted));
  }

  async findMaintenanceHistoryByCode(componentCode: string, vesselCode: string): Promise<ComponentMaintenanceHistory[]> {
    const db = await getDb();
    return await db.select().from(v2ComponentMaintenanceHistory)
      .where(and(
        eq(v2ComponentMaintenanceHistory.componentCode, componentCode),
        eq(v2ComponentMaintenanceHistory.vesselCode, vesselCode)
      ))
      .orderBy(desc(v2ComponentMaintenanceHistory.dateCompleted));
  }

  async findAllMaintenanceHistory(): Promise<ComponentMaintenanceHistory[]> {
    const db = await getDb();
    return await db.select().from(v2ComponentMaintenanceHistory)
      .orderBy(desc(v2ComponentMaintenanceHistory.createdAt));
  }

  async findMaintenanceHistoryItem(id: number): Promise<ComponentMaintenanceHistory | undefined> {
    const db = await getDb();
    const result = await db.select().from(v2ComponentMaintenanceHistory)
      .where(eq(v2ComponentMaintenanceHistory.id, id));
    return result[0];
  }
}
