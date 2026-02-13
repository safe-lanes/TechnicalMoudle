import { eq, and, desc } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  v2WorkOrders as workOrders,
  v2Jobs as jobs,
  v2Components as components,
  v2Spares as spares,
  v2PmsVesselSettings as pmsVesselSettings,
  v2ComponentMaintenanceHistory as componentMaintenanceHistory,
  v2InventoryTransactions as inventoryTransactions,
  v2SpareLocationStock as spareLocationStock,
  v2Locations as locations,
  v2JobComponentLinks as jobComponentLinks,
  type WorkOrder,
  type InsertWorkOrder,
  type Job,
  type Component,
  type Spare,
  type PmsVesselSettings,
  type InsertComponentMaintenanceHistory,
  type InsertInventoryTransaction,
  type InsertSpareLocationStock,
  type SpareLocationStock,
  type InsertLocation,
  type Location,
} from "@shared/v2/work-orders/schema";

export async function getWorkOrders(vesselId?: string): Promise<WorkOrder[]> {
  const db = await getDb();
  if (vesselId) {
    return db.select().from(workOrders).where(eq(workOrders.vesselId, vesselId));
  }
  return db.select().from(workOrders);
}

export async function getWorkOrder(id: string): Promise<WorkOrder | undefined> {
  const db = await getDb();
  const [result] = await db.select().from(workOrders).where(eq(workOrders.wouuid, id));
  return result;
}

export async function createWorkOrder(data: any): Promise<WorkOrder> {
  const db = await getDb();
  const [result] = await db.insert(workOrders).values(data).returning();
  return result;
}

export async function updateWorkOrder(id: string, data: Partial<any>): Promise<WorkOrder> {
  const db = await getDb();
  const [result] = await db.update(workOrders).set({ ...data, updatedAt: new Date() }).where(eq(workOrders.wouuid, id)).returning();
  return result;
}

export async function deleteWorkOrder(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(workOrders).where(eq(workOrders.wouuid, id));
}

export async function getWorkOrdersByVessel(vesselId: string): Promise<WorkOrder[]> {
  const db = await getDb();
  return db.select().from(workOrders).where(eq(workOrders.vesselId, vesselId));
}

export async function getWorkOrdersByJobId(jobId: string): Promise<WorkOrder[]> {
  const db = await getDb();
  return db.select().from(workOrders).where(eq(workOrders.jobId, jobId));
}

export async function getJobs(vesselId?: string): Promise<Job[]> {
  const db = await getDb();
  if (vesselId) {
    return db.select().from(jobs).where(eq(jobs.vesselId, vesselId));
  }
  return db.select().from(jobs);
}

export async function getJob(id: string): Promise<Job | undefined> {
  const db = await getDb();
  const [result] = await db.select().from(jobs).where(eq(jobs.juuid, id));
  return result;
}

export async function updateJob(id: string, data: Partial<any>): Promise<Job> {
  const db = await getDb();
  const [result] = await db.update(jobs).set({ ...data, updatedAt: new Date() }).where(eq(jobs.juuid, id)).returning();
  return result;
}

export async function getComponents(vesselId?: string): Promise<Component[]> {
  const db = await getDb();
  if (vesselId) {
    return db.select().from(components).where(eq(components.vesselId, vesselId));
  }
  return db.select().from(components);
}

export async function getComponent(id: string): Promise<Component | undefined> {
  const db = await getDb();
  const [result] = await db.select().from(components).where(eq(components.cuuid, id));
  return result;
}

export async function getComponentByCode(code: string, vesselId: string): Promise<Component | undefined> {
  const db = await getDb();
  const [result] = await db.select().from(components).where(
    and(eq(components.componentCode, code), eq(components.vesselId, vesselId))
  );
  return result;
}

export async function getComponentsByName(name: string, vesselId: string): Promise<Component[]> {
  const db = await getDb();
  return db.select().from(components).where(
    and(eq(components.name, name), eq(components.vesselId, vesselId))
  );
}

export async function updateComponent(id: string, data: Partial<any>): Promise<Component> {
  const db = await getDb();
  const [result] = await db.update(components).set(data).where(eq(components.cuuid, id)).returning();
  return result;
}

export async function getPmsVesselSettings(vesselId: string): Promise<PmsVesselSettings | undefined> {
  const db = await getDb();
  const [result] = await db.select().from(pmsVesselSettings).where(eq(pmsVesselSettings.vesselId, vesselId));
  return result;
}

export async function createMaintenanceHistory(data: InsertComponentMaintenanceHistory): Promise<any> {
  const db = await getDb();
  const [result] = await db.insert(componentMaintenanceHistory).values(data).returning();
  return result;
}

export async function getSpareByPartCode(partCode: string, vesselId: string): Promise<Spare | undefined> {
  const db = await getDb();
  const [result] = await db.select().from(spares).where(
    and(eq(spares.partCode, partCode), eq(spares.vesselId, vesselId), eq(spares.deleted, false))
  );
  return result;
}

export async function getSpareByPartNo(partNo: string, vesselId: string): Promise<Spare | undefined> {
  const db = await getDb();
  const [result] = await db.select().from(spares).where(
    and(eq(spares.partNumber, partNo), eq(spares.vesselId, vesselId), eq(spares.deleted, false))
  );
  return result;
}

export async function updateSpare(id: number, data: Partial<any>): Promise<Spare> {
  const db = await getDb();
  const [result] = await db.update(spares).set(data).where(eq(spares.id, id)).returning();
  return result;
}

export async function getSpareLocationStock(spareId: number, locationId: number): Promise<SpareLocationStock | undefined> {
  const db = await getDb();
  const [result] = await db.select().from(spareLocationStock).where(
    and(eq(spareLocationStock.spareId, spareId), eq(spareLocationStock.locationId, locationId))
  );
  return result;
}

export async function updateSpareLocationStock(id: number, data: Partial<any>): Promise<SpareLocationStock> {
  const db = await getDb();
  const [result] = await db.update(spareLocationStock).set(data).where(eq(spareLocationStock.id, id)).returning();
  return result;
}

export async function createInventoryTransaction(data: InsertInventoryTransaction): Promise<any> {
  const db = await getDb();
  const [result] = await db.insert(inventoryTransactions).values(data).returning();
  return result;
}

export async function getLocations(vesselId: string): Promise<Location[]> {
  const db = await getDb();
  return db.select().from(locations).where(eq(locations.vesselId, vesselId));
}

export async function getLocationByName(name: string, vesselId: string): Promise<Location | undefined> {
  const db = await getDb();
  const [result] = await db.select().from(locations).where(
    and(eq(locations.locationName, name), eq(locations.vesselId, vesselId))
  );
  return result;
}

export async function createLocation(data: InsertLocation): Promise<Location> {
  const db = await getDb();
  const [result] = await db.insert(locations).values(data).returning();
  return result;
}

export async function getJobComponentLinks(jobId: string): Promise<any[]> {
  const db = await getDb();
  return db.select().from(jobComponentLinks).where(eq(jobComponentLinks.jobId, jobId));
}

export async function getAllJobComponentLinks(): Promise<any[]> {
  const db = await getDb();
  return db.select().from(jobComponentLinks);
}
