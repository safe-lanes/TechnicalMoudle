import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../../../db';
import { workOrderDocuments, InsertWorkOrderDocument, WorkOrderDocument } from '@shared/schema';

export async function findByWorkOrderId(workOrderId: string): Promise<WorkOrderDocument[]> {
  const db = await getDb();
  return db.select().from(workOrderDocuments).where(eq(workOrderDocuments.workOrderId, workOrderId));
}

export async function findById(id: string): Promise<WorkOrderDocument | undefined> {
  const db = await getDb();
  const [doc] = await db.select().from(workOrderDocuments).where(eq(workOrderDocuments.id, id));
  return doc;
}

export async function create(data: InsertWorkOrderDocument & { id: string }): Promise<WorkOrderDocument> {
  const db = await getDb();
  const [doc] = await db.insert(workOrderDocuments).values(data).returning();
  return doc;
}

export async function deleteById(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(workOrderDocuments).where(eq(workOrderDocuments.id, id));
}

export async function countByWorkOrderAndType(workOrderId: string, documentType: string): Promise<number> {
  const db = await getDb();
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workOrderDocuments)
    .where(and(
      eq(workOrderDocuments.workOrderId, workOrderId),
      eq(workOrderDocuments.documentType, documentType)
    ));
  return result?.count ?? 0;
}

export async function linkExecutionId(workOrderId: string, executionId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(workOrderDocuments)
    .set({ executionId })
    .where(eq(workOrderDocuments.workOrderId, workOrderId));
}
