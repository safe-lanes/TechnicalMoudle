import type { IStorage } from "../storage";
import type { ChangeRequest, Component, Spare, StoresItem, InsertWorkOrder } from "@shared/schema";

export interface AppliedChange {
  field: string;
  oldValue: any;
  newValue: any;
  appliedAt: string;
  success: boolean;
  error?: string;
}

export interface ApplicationResult {
  success: boolean;
  appliedChanges: AppliedChange[];
  errors: string[];
  targetUpdated: boolean;
}

export class ChangeRequestApplicationService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  async applyChangeRequest(changeRequest: ChangeRequest): Promise<ApplicationResult> {
    const result: ApplicationResult = {
      success: false,
      appliedChanges: [],
      errors: [],
      targetUpdated: false
    };

    if (!changeRequest.targetType || !changeRequest.targetId) {
      result.errors.push("Change request has no target specified");
      return result;
    }

    const proposedChanges = changeRequest.proposedChangesJson as any[] | null;
    if (!proposedChanges || proposedChanges.length === 0) {
      result.errors.push("No proposed changes to apply");
      return result;
    }

    console.log(`[CR_APPLY] Starting application for CR-${changeRequest.id}, category: ${changeRequest.category}, targetType: ${changeRequest.targetType}, targetId: ${changeRequest.targetId}`);
    console.log(`[CR_APPLY] Proposed changes count: ${proposedChanges.length}`);

    try {
      switch (changeRequest.category) {
        case "components":
          await this.applyComponentChanges(changeRequest, proposedChanges, result);
          break;
        case "work_orders":
          await this.applyWorkOrderChanges(changeRequest, proposedChanges, result);
          break;
        case "spares":
          await this.applySpareChanges(changeRequest, proposedChanges, result);
          break;
        case "stores":
          await this.applyStoreChanges(changeRequest, proposedChanges, result);
          break;
        default:
          result.errors.push(`Unknown category: ${changeRequest.category}`);
      }

      // Success requires: no critical errors AND at least one field was successfully applied
      const successfulChanges = result.appliedChanges.filter(c => c.success);
      const failedChanges = result.appliedChanges.filter(c => !c.success);
      
      result.targetUpdated = successfulChanges.length > 0;
      result.success = result.errors.length === 0 && successfulChanges.length > 0;
      
      // If no changes succeeded, add an error explaining why
      if (!result.success && successfulChanges.length === 0 && result.appliedChanges.length > 0) {
        result.errors.push(`No changes were successfully applied. ${failedChanges.length} field(s) failed validation.`);
      }
      
      console.log(`[CR_APPLY] Application complete. Success: ${result.success}, Applied: ${successfulChanges.length}/${result.appliedChanges.length}, Errors: ${result.errors.length}`);
    } catch (error: any) {
      console.error(`[CR_APPLY] Critical error applying changes:`, error);
      result.errors.push(`Application failed: ${error.message}`);
    }

    return result;
  }

  private async applyComponentChanges(
    changeRequest: ChangeRequest,
    proposedChanges: any[],
    result: ApplicationResult
  ): Promise<void> {
    const componentId = changeRequest.targetId!;
    
    const component = await this.storage.getComponent(componentId);
    if (!component) {
      result.errors.push(`Component not found: ${componentId}`);
      return;
    }

    const updateData: Partial<Component> = {};
    const now = new Date().toISOString();

    for (const change of proposedChanges) {
      const field = change.field || change.fieldName;
      const newValue = change.newValue ?? change.proposedValue;
      const oldValue = change.oldValue ?? change.currentValue;

      if (!field) {
        console.warn(`[CR_APPLY] Skipping change with no field name:`, change);
        continue;
      }

      try {
        if (this.isValidComponentField(field)) {
          (updateData as any)[field] = this.normalizeValue(newValue, field);
          
          result.appliedChanges.push({
            field,
            oldValue,
            newValue,
            appliedAt: now,
            success: true
          });
        } else if (field === "parentId" || field === "parent") {
          updateData.parentId = newValue;
          result.appliedChanges.push({
            field: "parentId",
            oldValue: component.parentId,
            newValue,
            appliedAt: now,
            success: true
          });
        } else {
          console.warn(`[CR_APPLY] Unrecognized component field: ${field}`);
          result.appliedChanges.push({
            field,
            oldValue,
            newValue,
            appliedAt: now,
            success: false,
            error: `Unrecognized field: ${field}`
          });
        }
      } catch (error: any) {
        result.appliedChanges.push({
          field,
          oldValue,
          newValue,
          appliedAt: now,
          success: false,
          error: error.message
        });
      }
    }

    if (Object.keys(updateData).length > 0) {
      try {
        await this.storage.updateComponent(componentId, updateData);
        console.log(`[CR_APPLY] Component ${componentId} updated with ${Object.keys(updateData).length} fields`);
      } catch (error: any) {
        result.errors.push(`Failed to update component: ${error.message}`);
        result.appliedChanges.forEach(c => {
          if (c.success) {
            c.success = false;
            c.error = "Update transaction failed";
          }
        });
      }
    }
  }

  private async applyWorkOrderChanges(
    changeRequest: ChangeRequest,
    proposedChanges: any[],
    result: ApplicationResult
  ): Promise<void> {
    const workOrderId = changeRequest.targetId!;
    
    const workOrder = await this.storage.getWorkOrder(workOrderId);
    if (!workOrder) {
      result.errors.push(`Work order not found: ${workOrderId}`);
      return;
    }

    const updateData: Partial<InsertWorkOrder> = {};
    const now = new Date().toISOString();

    for (const change of proposedChanges) {
      const field = change.field || change.fieldName;
      const newValue = change.newValue ?? change.proposedValue;
      const oldValue = change.oldValue ?? change.currentValue;

      if (!field) continue;

      try {
        if (this.isValidWorkOrderField(field)) {
          (updateData as any)[field] = this.normalizeValue(newValue, field);
          
          result.appliedChanges.push({
            field,
            oldValue,
            newValue,
            appliedAt: now,
            success: true
          });
        } else {
          result.appliedChanges.push({
            field,
            oldValue,
            newValue,
            appliedAt: now,
            success: false,
            error: `Unrecognized field: ${field}`
          });
        }
      } catch (error: any) {
        result.appliedChanges.push({
          field,
          oldValue,
          newValue,
          appliedAt: now,
          success: false,
          error: error.message
        });
      }
    }

    if (Object.keys(updateData).length > 0) {
      try {
        await this.storage.updateWorkOrder(workOrderId, updateData);
        console.log(`[CR_APPLY] Work order ${workOrderId} updated with ${Object.keys(updateData).length} fields`);
        
        if (updateData.maintenanceIntervalValue || updateData.intervalRunningHour || updateData.maintenanceIntervalUnit) {
          console.log(`[CR_APPLY] Interval fields changed - next due recalculation may be needed`);
        }
      } catch (error: any) {
        result.errors.push(`Failed to update work order: ${error.message}`);
        result.appliedChanges.forEach(c => {
          if (c.success) {
            c.success = false;
            c.error = "Update transaction failed";
          }
        });
      }
    }
  }

  private async applySpareChanges(
    changeRequest: ChangeRequest,
    proposedChanges: any[],
    result: ApplicationResult
  ): Promise<void> {
    const spareId = parseInt(changeRequest.targetId!, 10);
    
    if (isNaN(spareId)) {
      result.errors.push(`Invalid spare ID: ${changeRequest.targetId}`);
      return;
    }

    const spare = await this.storage.getSpare(spareId);
    if (!spare) {
      result.errors.push(`Spare not found: ${spareId}`);
      return;
    }

    const updateData: Partial<Spare> = {};
    const now = new Date().toISOString();

    for (const change of proposedChanges) {
      const field = change.field || change.fieldName;
      const newValue = change.newValue ?? change.proposedValue;
      const oldValue = change.oldValue ?? change.currentValue;

      if (!field) continue;

      try {
        if (field === "rob" || field === "qty" || field === "quantity") {
          result.appliedChanges.push({
            field,
            oldValue,
            newValue,
            appliedAt: now,
            success: false,
            error: "Direct ROB/quantity updates must use adjustment transactions"
          });
          continue;
        }

        if (this.isValidSpareField(field)) {
          (updateData as any)[field] = this.normalizeValue(newValue, field);
          
          result.appliedChanges.push({
            field,
            oldValue,
            newValue,
            appliedAt: now,
            success: true
          });
        } else {
          result.appliedChanges.push({
            field,
            oldValue,
            newValue,
            appliedAt: now,
            success: false,
            error: `Unrecognized field: ${field}`
          });
        }
      } catch (error: any) {
        result.appliedChanges.push({
          field,
          oldValue,
          newValue,
          appliedAt: now,
          success: false,
          error: error.message
        });
      }
    }

    if (Object.keys(updateData).length > 0) {
      try {
        await this.storage.updateSpare(spareId, updateData);
        console.log(`[CR_APPLY] Spare ${spareId} updated with ${Object.keys(updateData).length} fields`);
      } catch (error: any) {
        result.errors.push(`Failed to update spare: ${error.message}`);
        result.appliedChanges.forEach(c => {
          if (c.success) {
            c.success = false;
            c.error = "Update transaction failed";
          }
        });
      }
    }
  }

  private async applyStoreChanges(
    changeRequest: ChangeRequest,
    proposedChanges: any[],
    result: ApplicationResult
  ): Promise<void> {
    const storeId = parseInt(changeRequest.targetId!, 10);
    
    if (isNaN(storeId)) {
      result.errors.push(`Invalid store ID: ${changeRequest.targetId}`);
      return;
    }

    const store = await this.storage.getStoresItem(storeId);
    if (!store) {
      result.errors.push(`Store item not found: ${storeId}`);
      return;
    }

    const updateData: Partial<StoresItem> = {};
    const now = new Date().toISOString();

    for (const change of proposedChanges) {
      const field = change.field || change.fieldName;
      const newValue = change.newValue ?? change.proposedValue;
      const oldValue = change.oldValue ?? change.currentValue;

      if (!field) continue;

      try {
        if (field === "rob" || field === "robLocationA" || field === "robLocationB") {
          result.appliedChanges.push({
            field,
            oldValue,
            newValue,
            appliedAt: now,
            success: false,
            error: "Direct ROB updates must use consume/receive/adjust methods"
          });
          continue;
        }

        if (this.isValidStoreField(field)) {
          (updateData as any)[field] = this.normalizeValue(newValue, field);
          
          result.appliedChanges.push({
            field,
            oldValue,
            newValue,
            appliedAt: now,
            success: true
          });
        } else {
          result.appliedChanges.push({
            field,
            oldValue,
            newValue,
            appliedAt: now,
            success: false,
            error: `Unrecognized field: ${field}`
          });
        }
      } catch (error: any) {
        result.appliedChanges.push({
          field,
          oldValue,
          newValue,
          appliedAt: now,
          success: false,
          error: error.message
        });
      }
    }

    if (Object.keys(updateData).length > 0) {
      try {
        await this.storage.updateStoresItem(storeId, updateData);
        console.log(`[CR_APPLY] Store item ${storeId} updated with ${Object.keys(updateData).length} fields`);
      } catch (error: any) {
        result.errors.push(`Failed to update store item: ${error.message}`);
        result.appliedChanges.forEach(c => {
          if (c.success) {
            c.success = false;
            c.error = "Update transaction failed";
          }
        });
      }
    }
  }

  private isValidComponentField(field: string): boolean {
    const validFields = [
      "name", "description", "maker", "model", "serialNumber",
      "department", "criticality", "status", "location",
      "installationDate", "lastMaintenanceDate", "notes",
      "specifications", "documents", "images", "isActive",
      "componentCode", "sfiCode", "sfiDescription",
      "currentCumulativeRH", "runningHoursInheritance", "runningHoursSource"
    ];
    return validFields.includes(field);
  }

  private isValidWorkOrderField(field: string): boolean {
    const validFields = [
      "jobTitle", "description", "jobType", "priority", "status",
      "department", "assignedTo", "instructions", "notes",
      "maintenanceIntervalValue", "intervalUnit", "intervalRunningHour",
      "lastDoneDate", "lastDoneRunningHours", "nextDueDate", "nextDueRunningHours",
      "isActive", "criticality", "safetyInstructions"
    ];
    return validFields.includes(field);
  }

  private isValidSpareField(field: string): boolean {
    const validFields = [
      "partCode", "partName", "description", "maker", "model",
      "drawingNo", "unit", "minQty", "maxQty", "reorderLevel",
      "location", "category", "criticality", "isActive",
      "specifications", "alternatePartNo", "notes"
    ];
    return validFields.includes(field);
  }

  private isValidStoreField(field: string): boolean {
    const validFields = [
      "itemCode", "itemName", "description", "category", "unit",
      "minQty", "maxQty", "reorderLevel", "location",
      "locationA", "locationB", "supplier", "notes", "isActive"
    ];
    return validFields.includes(field);
  }

  private normalizeValue(value: any, field: string): any {
    if (value === "" || value === undefined) {
      return null;
    }

    const numericFields = [
      "maintenanceIntervalValue", "intervalRunningHour",
      "minQty", "maxQty", "reorderLevel", "currentCumulativeRH",
      "lastDoneRunningHours", "nextDueRunningHours"
    ];

    if (numericFields.includes(field)) {
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }

    const dateFields = [
      "installationDate", "lastMaintenanceDate", "lastDoneDate", "nextDueDate"
    ];

    if (dateFields.includes(field)) {
      if (value instanceof Date) {
        return value;
      }
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }

    const booleanFields = ["isActive"];
    if (booleanFields.includes(field)) {
      if (typeof value === "boolean") return value;
      if (value === "true" || value === "1") return true;
      if (value === "false" || value === "0") return false;
      return null;
    }

    return value;
  }
}
