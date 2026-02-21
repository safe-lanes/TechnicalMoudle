import { storage } from '../../../storage';
import type {
  Defect, InsertDefect,
  DefectAction, InsertDefectAction,
  DefectAttachment, InsertDefectAttachment,
  RecurringDefect
} from '@shared/schema';

// ── Core Defects ──

export async function getDefects(filters?: any): Promise<Defect[]> {
  return storage.getDefects(filters);
}

export async function getDefectsCount(filters?: any): Promise<number> {
  return storage.getDefectsCount(filters);
}

export async function getDefect(id: string): Promise<Defect | undefined> {
  return storage.getDefect(id);
}

export async function createDefect(defect: InsertDefect): Promise<Defect> {
  return storage.createDefect(defect);
}

export async function updateDefect(id: string, updates: Partial<InsertDefect>): Promise<Defect> {
  return storage.updateDefect(id, updates);
}

export async function deleteDefect(id: string): Promise<void> {
  return storage.deleteDefect(id);
}

// ── Defect Actions ──

export async function getDefectActions(defectId: string): Promise<DefectAction[]> {
  return storage.getDefectActions(defectId);
}

export async function createDefectAction(action: InsertDefectAction): Promise<DefectAction> {
  return storage.createDefectAction(action);
}

export async function updateDefectAction(id: number, updates: Partial<InsertDefectAction>): Promise<DefectAction> {
  return storage.updateDefectAction(id, updates);
}

export async function deleteDefectAction(id: number): Promise<void> {
  return storage.deleteDefectAction(id);
}

// ── Defect Attachments ──

export async function getDefectAttachments(defectId: string): Promise<DefectAttachment[]> {
  return storage.getDefectAttachments(defectId);
}

export async function createDefectAttachment(attachment: InsertDefectAttachment): Promise<DefectAttachment> {
  return storage.createDefectAttachment(attachment);
}

export async function deleteDefectAttachment(id: number): Promise<void> {
  return storage.deleteDefectAttachment(id);
}

// ── Defect Workflow (Notes, Linking, Closure) ──

export async function addDefectNote(defectId: string, note: any): Promise<Defect> {
  return storage.addDefectNote(defectId, note);
}

export async function linkDefects(defectId: string, linkedDefectIds: string[]): Promise<Defect> {
  return storage.linkDefects(defectId, linkedDefectIds);
}

export async function closeDefect(defectId: string, closure: { closedBy: string; closureComment: string; closureFiles?: string[] }): Promise<Defect> {
  return storage.closeDefect(defectId, closure);
}

// ── Recurring Defects ──

export async function getRecurringDefects(filters?: any): Promise<RecurringDefect[]> {
  return storage.getRecurringDefects(filters);
}

export async function getRecurringDefect(id: number): Promise<RecurringDefect | undefined> {
  return storage.getRecurringDefect(id);
}

export async function calculateAndUpdateRecurringDefects(equipmentKey: string, windowMonths?: number): Promise<RecurringDefect | null> {
  return storage.calculateAndUpdateRecurringDefects(equipmentKey, windowMonths);
}

export async function getDefectsForRecurring(recurringId: number): Promise<Defect[]> {
  return storage.getDefectsForRecurring(recurringId);
}

export async function recalculateAllRecurringDefects(): Promise<void> {
  return storage.recalculateAllRecurringDefects();
}
