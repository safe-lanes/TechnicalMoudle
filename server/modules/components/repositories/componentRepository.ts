import { storage } from '../../../storage';
import { getPostgresClient } from '../../../postgresClient';
import { equipmentCategories } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { Component, InsertComponent } from '@shared/schema';

// ── Core Component Methods ──

async function augmentWithSortOrder(components: Component[]): Promise<Component[]> {
  if (components.length === 0) return components;
  const { pool } = getPostgresClient();
  const ids = components.map(c => c.id);
  const result = await pool.query(
    `SELECT id, sort_order FROM components WHERE id = ANY($1)`,
    [ids]
  );
  const sortOrderMap = new Map<string, number>();
  for (const row of result.rows) {
    sortOrderMap.set(row.id, row.sort_order ?? 0);
  }
  return components.map(c => ({
    ...c,
    sortOrder: sortOrderMap.get(c.id) ?? 0,
  })) as Component[];
}

export async function findByVesselId(vesselId: string): Promise<Component[]> {
  const components = await storage.getComponents(vesselId);
  return augmentWithSortOrder(components);
}

export async function findById(id: string): Promise<Component | undefined> {
  const component = await storage.getComponent(id);
  if (!component) return undefined;
  const [augmented] = await augmentWithSortOrder([component]);
  return augmented;
}

export async function findAll(): Promise<Component[]> {
  const allVessels = await storage.getVessels();
  const allComponents: Component[] = [];
  for (const vessel of allVessels) {
    const vesselComponents = await storage.getComponents(vessel.id);
    allComponents.push(...vesselComponents);
  }
  return augmentWithSortOrder(allComponents);
}

export async function create(data: InsertComponent): Promise<Component> {
  return storage.createComponent(data);
}

export async function update(id: string, data: Partial<Component>): Promise<Component> {
  return storage.updateComponent(id, data);
}

export async function remove(id: string): Promise<void> {
  return storage.deleteComponent(id);
}

export async function inactivate(id: string, vesselId: string, userId: string) {
  return storage.inactivateComponent(id, vesselId, userId);
}

export async function bulkUpsert(components: InsertComponent[]): Promise<{ created: number; updated: number }> {
  return storage.bulkUpsertComponents(components);
}

export async function setRunningHours(params: {
  componentId: string;
  newRHValue: number;
  updateSource: string;
  userId: string;
  lastUpdatedDate?: string;
}) {
  return storage.setComponentRunningHours(params);
}

export async function getInheritedComponents(masterComponentId: string): Promise<Component[]> {
  return storage.getInheritedComponents(masterComponentId);
}

// ── Component Document Methods ──

export async function findDocuments(componentId: string) {
  return storage.getComponentDocuments(componentId);
}

export async function findDocument(id: number) {
  return storage.getComponentDocument(id);
}

export async function createDocument(data: any) {
  return storage.createComponentDocument(data);
}

export async function updateDocument(id: number, data: any) {
  return storage.updateComponentDocument(id, data);
}

export async function deleteDocument(id: number) {
  return storage.deleteComponentDocument(id);
}

// ── Component Class Regulatory Methods ──

export async function findClassRegulatory(componentId: string) {
  return storage.getComponentClassRegulatory(componentId);
}

export async function createClassRegulatory(data: any) {
  return storage.createComponentClassRegulatory(data);
}

export async function updateClassRegulatory(id: number, data: any) {
  return storage.updateComponentClassRegulatory(id, data);
}

export async function deleteClassRegulatory(id: number) {
  return storage.deleteComponentClassRegulatory(id);
}

// ── Component Requisition Methods ──

export async function findRequisitions(componentId: string) {
  return storage.getComponentRequisitions(componentId);
}

export async function findAllRequisitions(vesselCode?: string) {
  return storage.getAllComponentRequisitions(vesselCode);
}

export async function findRequisitionItem(id: number) {
  return storage.getComponentRequisitionItem(id);
}

export async function createRequisition(data: any) {
  return storage.createComponentRequisition(data);
}

export async function updateRequisition(id: number, data: any) {
  return storage.updateComponentRequisition(id, data);
}

export async function deleteRequisition(id: number) {
  return storage.deleteComponentRequisition(id);
}

// ── Maintenance History Methods ──

export async function findAllMaintenanceHistory() {
  return storage.getAllComponentMaintenanceHistory();
}

export async function findMaintenanceHistory(componentId: string) {
  return storage.getComponentMaintenanceHistory(componentId);
}

export async function findMaintenanceHistoryByCode(componentCode: string, vesselCode: string) {
  return storage.getComponentMaintenanceHistoryByCode(componentCode, vesselCode);
}

export async function findMaintenanceHistoryItem(id: number) {
  return storage.getComponentMaintenanceHistoryItem(id);
}

// ── Component Sort Order & Hierarchy ──

export async function updateSortOrder(updates: { id: string; sortOrder: number }[]) {
  const { pool } = getPostgresClient();
  for (const update of updates) {
    await pool.query(
      `UPDATE components SET sort_order = $1 WHERE id = $2`,
      [update.sortOrder, update.id]
    );
  }
  return { success: true, updated: updates.length };
}

export async function updateHierarchyAndSortOrder(
  sortUpdates: { id: string; sortOrder: number }[],
  reparents: { id: string; newParentCode: string }[]
) {
  const { pool } = getPostgresClient();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const rp of reparents) {
      const componentResult = await client.query(
        `SELECT component_code FROM components WHERE id = $1`,
        [rp.id]
      );
      if (componentResult.rows.length === 0) {
        throw new Error(`Component not found: ${rp.id}`);
      }
      const movingCode = componentResult.rows[0].component_code;

      let checkParent = rp.newParentCode;
      const visited = new Set<string>();
      while (checkParent) {
        if (checkParent === movingCode) {
          throw new Error(`Circular hierarchy detected: cannot move "${movingCode}" under "${rp.newParentCode}" because it would create a cycle`);
        }
        if (visited.has(checkParent)) break;
        visited.add(checkParent);
        const parentResult = await client.query(
          `SELECT parent_id FROM components WHERE component_code = $1 AND vessel_id = (SELECT vessel_id FROM components WHERE id = $2)`,
          [checkParent, rp.id]
        );
        checkParent = parentResult.rows[0]?.parent_id || null;
      }

      await client.query(
        `UPDATE components SET parent_id = $1, parent_component = $1 WHERE id = $2`,
        [rp.newParentCode, rp.id]
      );
    }

    for (const update of sortUpdates) {
      await client.query(
        `UPDATE components SET sort_order = $1 WHERE id = $2`,
        [update.sortOrder, update.id]
      );
    }

    await client.query('COMMIT');
    return { success: true, updated: sortUpdates.length, reparented: reparents.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ── Equipment Category Methods (direct DB — no storage.* methods exist) ──

export async function findEquipmentCategories() {
  const { db } = getPostgresClient();
  return db.select().from(equipmentCategories).orderBy(equipmentCategories.sortOrder);
}

export async function createEquipmentCategory(data: { name: string; sortOrder?: number; isActive?: boolean }) {
  const { db } = getPostgresClient();
  const [category] = await db.insert(equipmentCategories).values({
    name: data.name,
    sortOrder: data.sortOrder ?? 0,
    isActive: data.isActive ?? true,
  }).returning();
  return category;
}

export async function updateEquipmentCategory(id: number, data: { name?: string; sortOrder?: number; isActive?: boolean }) {
  const { db } = getPostgresClient();
  const updates: any = { updatedAt: new Date() };
  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  const [category] = await db.update(equipmentCategories)
    .set(updates)
    .where(eq(equipmentCategories.id, id))
    .returning();
  return category;
}

export async function deleteEquipmentCategory(id: number) {
  const { db } = getPostgresClient();
  const [deleted] = await db.delete(equipmentCategories)
    .where(eq(equipmentCategories.id, id))
    .returning();
  return deleted;
}
