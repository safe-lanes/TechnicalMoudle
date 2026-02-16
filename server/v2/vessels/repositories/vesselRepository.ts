import { eq, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import {
  v2Vessels, v2Fleets,
  type Vessel, type InsertVessel, type Fleet,
} from '@shared/v2/vessels/schema';

export class VesselRepository {

  async getAll(): Promise<Vessel[]> {
    const db = await getDb();
    return await db.select().from(v2Vessels);
  }

  async getByVuuid(vuuid: string): Promise<Vessel | undefined> {
    const db = await getDb();
    const results = await db.select().from(v2Vessels)
      .where(eq(v2Vessels.vuuid, vuuid));
    return results[0];
  }

  async create(data: InsertVessel): Promise<Vessel> {
    const db = await getDb();
    const existing = await db.select().from(v2Vessels)
      .where(eq(v2Vessels.vuuid, data.vuuid));
    if (existing.length > 0) {
      throw new Error(`Vessel with vuuid '${data.vuuid}' already exists`);
    }
    const result = await db.insert(v2Vessels).values(data).returning();
    return result[0];
  }

  async update(vuuid: string, data: Partial<InsertVessel>): Promise<Vessel> {
    const db = await getDb();
    const result = await db.update(v2Vessels)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(v2Vessels.vuuid, vuuid))
      .returning();
    if (result.length === 0) {
      throw new Error(`Vessel with vuuid '${vuuid}' not found`);
    }
    return result[0];
  }

  async assignFleet(vuuid: string, fleetId: string | null): Promise<Vessel> {
    const db = await getDb();
    const result = await db.update(v2Vessels)
      .set({ fleetId, updatedAt: new Date() })
      .where(eq(v2Vessels.vuuid, vuuid))
      .returning();
    if (result.length === 0) {
      throw new Error(`Vessel with vuuid '${vuuid}' not found`);
    }
    return result[0];
  }

  async getWithFleets(): Promise<Array<Vessel & { fleetName?: string; fleetCode?: string }>> {
    const db = await getDb();
    const allVessels = await db.select().from(v2Vessels);
    const allFleets = await db.select().from(v2Fleets);

    const fleetMap = new Map<string, Fleet>(allFleets.map(f => [f.id, f]));

    return allVessels.map(v => {
      const fleet = v.fleetId ? fleetMap.get(v.fleetId) : undefined;
      return {
        ...v,
        fleetName: fleet?.name,
        fleetCode: fleet?.code ?? undefined,
      };
    });
  }

  async getByFleet(fleetId: string): Promise<Vessel[]> {
    const db = await getDb();
    return await db.select().from(v2Vessels)
      .where(eq(v2Vessels.fleetId, fleetId));
  }

  async getActiveVessels(): Promise<Vessel[]> {
    const db = await getDb();
    return await db.select().from(v2Vessels)
      .where(eq(v2Vessels.isActive, true));
  }
}
