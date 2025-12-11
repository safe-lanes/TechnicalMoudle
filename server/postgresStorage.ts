import { eq, and, desc, sql, inArray, or } from 'drizzle-orm';
import { getDb } from './db';
import {
  users,
  fleets,
  vessels,
  pmsVesselSettings,
  type User,
  type InsertUser,
  type Fleet,
  type InsertFleet,
  type Vessel,
  type InsertVessel,
  type PmsVesselSettings,
  type InsertPmsVesselSettings,
} from '@shared/schema';

/**
 * PostgreSQL Storage Implementation
 * Module 1: Core Reference Data (users, fleets, vessels, pms_vessel_settings)
 * 
 * This file implements IStorage methods using PostgreSQL via Drizzle ORM.
 * Additional modules will be added incrementally.
 */
export class PostgresStorage {
  
  // ============= USERS (Module 1) =============
  
  async getUser(id: number): Promise<User | undefined> {
    const db = await getDb();
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const db = await getDb();
    const result = await db.select().from(users).where(eq(users.username, username));
    return result[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const db = await getDb();
    const result = await db.insert(users).values(user).returning();
    return result[0];
  }

  async getUsers(): Promise<User[]> {
    const db = await getDb();
    return await db.select().from(users);
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const db = await getDb();
    const result = await db.update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`User ${id} not found`);
    }
    return result[0];
  }

  async deleteUser(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(users).where(eq(users.id, id));
  }

  // ============= FLEETS (Module 1) =============

  async getFleets(): Promise<Fleet[]> {
    const db = await getDb();
    return await db.select().from(fleets);
  }

  async getFleet(id: string): Promise<Fleet | undefined> {
    const db = await getDb();
    const result = await db.select().from(fleets).where(eq(fleets.id, id));
    return result[0];
  }

  async getFleetByCode(code: string): Promise<Fleet | undefined> {
    const db = await getDb();
    const result = await db.select().from(fleets).where(eq(fleets.code, code));
    return result[0];
  }

  async createFleet(fleet: InsertFleet): Promise<Fleet> {
    const db = await getDb();
    const result = await db.insert(fleets).values(fleet).returning();
    return result[0];
  }

  async updateFleet(id: string, data: Partial<Fleet>): Promise<Fleet> {
    const db = await getDb();
    const result = await db.update(fleets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fleets.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Fleet ${id} not found`);
    }
    return result[0];
  }

  async deleteFleet(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(fleets).where(eq(fleets.id, id));
  }

  // ============= VESSELS (Module 1) =============

  async getVessels(): Promise<Array<{id: string, name: string, code: string}>> {
    const db = await getDb();
    const result = await db.select().from(vessels);
    return result.map(v => ({
      id: v.id,
      name: v.name,
      code: v.code
    }));
  }

  async getVessel(id: string): Promise<Vessel | undefined> {
    const db = await getDb();
    const result = await db.select().from(vessels).where(eq(vessels.id, id));
    return result[0];
  }

  async getVesselByCode(code: string): Promise<Vessel | undefined> {
    const db = await getDb();
    const result = await db.select().from(vessels).where(eq(vessels.code, code));
    return result[0];
  }

  async getVesselIdByName(vesselName: string): Promise<string | undefined> {
    const db = await getDb();
    const result = await db.select().from(vessels).where(eq(vessels.name, vesselName));
    return result[0]?.id;
  }

  async createVessel(vessel: InsertVessel): Promise<Vessel> {
    const db = await getDb();
    const result = await db.insert(vessels).values(vessel).returning();
    return result[0];
  }

  async updateVessel(id: string, data: Partial<Vessel>): Promise<Vessel> {
    const db = await getDb();
    const result = await db.update(vessels)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(vessels.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`Vessel ${id} not found`);
    }
    return result[0];
  }

  async deleteVessel(id: string): Promise<void> {
    const db = await getDb();
    await db.delete(vessels).where(eq(vessels.id, id));
  }

  // ============= PMS VESSEL SETTINGS (Module 1) =============

  async getPmsVesselSettings(vesselId: string): Promise<PmsVesselSettings | undefined> {
    const db = await getDb();
    const result = await db.select().from(pmsVesselSettings)
      .where(eq(pmsVesselSettings.vesselId, vesselId));
    return result[0];
  }

  async getAllPmsVesselSettings(): Promise<PmsVesselSettings[]> {
    const db = await getDb();
    return await db.select().from(pmsVesselSettings);
  }

  async createPmsVesselSettings(settings: InsertPmsVesselSettings): Promise<PmsVesselSettings> {
    const db = await getDb();
    const result = await db.insert(pmsVesselSettings).values(settings).returning();
    return result[0];
  }

  async updatePmsVesselSettings(id: number, data: Partial<PmsVesselSettings>): Promise<PmsVesselSettings> {
    const db = await getDb();
    const result = await db.update(pmsVesselSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pmsVesselSettings.id, id))
      .returning();
    if (!result[0]) {
      throw new Error(`PMS Vessel Settings ${id} not found`);
    }
    return result[0];
  }

  async upsertPmsVesselSettings(settings: InsertPmsVesselSettings): Promise<PmsVesselSettings> {
    const existing = await this.getPmsVesselSettings(settings.vesselId);
    
    if (existing) {
      return await this.updatePmsVesselSettings(existing.id, settings);
    } else {
      return await this.createPmsVesselSettings(settings);
    }
  }

  async deletePmsVesselSettings(id: number): Promise<void> {
    const db = await getDb();
    await db.delete(pmsVesselSettings).where(eq(pmsVesselSettings.id, id));
  }
}

export const postgresStorage = new PostgresStorage();
