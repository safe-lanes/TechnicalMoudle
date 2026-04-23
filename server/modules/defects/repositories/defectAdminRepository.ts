import { getPostgresClient } from '../../../postgresClient';
import { defectCategories, defectTypes } from '@shared/schema';
import { eq } from 'drizzle-orm';

// ── Defect Categories ──

export async function getCategories() {
  const { db } = getPostgresClient();
  return db.select().from(defectCategories).orderBy(defectCategories.sortOrder);
}

export async function createCategory(data: { name: string; sortOrder?: number; isActive?: boolean }) {
  const { db } = getPostgresClient();
  const [category] = await db.insert(defectCategories).values({
    name: data.name,
    sortOrder: data.sortOrder ?? 0,
    isActive: data.isActive ?? true,
  }).returning();
  return category;
}

export async function updateCategory(id: number, updates: any) {
  const { db } = getPostgresClient();
  // Fetch existing row for old values (needed for future sync field logging)
  const existing = await db.select().from(defectCategories).where(eq(defectCategories.id, id)).limit(1);
  if (!existing[0]) {
    return undefined;
  }
  const existingCategory = existing[0];

  const [category] = await db.update(defectCategories)
    .set(updates)
    .where(eq(defectCategories.id, id))
    .returning();
  return category;
}

export async function deleteCategory(id: number) {
  const { db } = getPostgresClient();
  // Fetch existing row to verify it exists before deletion (needed for future sync field logging)
  const existing = await db.select().from(defectCategories).where(eq(defectCategories.id, id)).limit(1);
  if (!existing[0]) {
    return undefined;
  }

  const [deleted] = await db.delete(defectCategories)
    .where(eq(defectCategories.id, id))
    .returning();
  return deleted;
}

// ── Defect Types ──

export async function getTypes() {
  const { db } = getPostgresClient();
  return db.select().from(defectTypes).orderBy(defectTypes.sortOrder);
}

export async function createType(data: { name: string; sortOrder?: number; isActive?: boolean }) {
  const { db } = getPostgresClient();
  const [defectType] = await db.insert(defectTypes).values({
    name: data.name,
    sortOrder: data.sortOrder ?? 0,
    isActive: data.isActive ?? true,
  }).returning();
  return defectType;
}

export async function updateType(id: number, updates: any) {
  const { db } = getPostgresClient();
  // Fetch existing row for old values (needed for future sync field logging)
  const existing = await db.select().from(defectTypes).where(eq(defectTypes.id, id)).limit(1);
  if (!existing[0]) {
    return undefined;
  }
  const existingType = existing[0];

  const [defectType] = await db.update(defectTypes)
    .set(updates)
    .where(eq(defectTypes.id, id))
    .returning();
  return defectType;
}

export async function deleteType(id: number) {
  const { db } = getPostgresClient();
  // Fetch existing row to verify it exists before deletion (needed for future sync field logging)
  const existing = await db.select().from(defectTypes).where(eq(defectTypes.id, id)).limit(1);
  if (!existing[0]) {
    return undefined;
  }

  const [deleted] = await db.delete(defectTypes)
    .where(eq(defectTypes.id, id))
    .returning();
  return deleted;
}
