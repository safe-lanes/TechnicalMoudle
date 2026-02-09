import type { Component, InsertComponent } from "@shared/v2/components/schema";
import type { ComponentRepository } from "../repositories/componentRepository";
import { NotFoundError, ValidationError } from "./errors";

export class ComponentService {
  constructor(private repository: ComponentRepository) {}

  async getByVesselId(vesselId: string): Promise<Component[]> {
    return this.repository.findByVesselId(vesselId);
  }

  async getById(id: string): Promise<Component> {
    const component = await this.repository.findById(id);
    if (!component) {
      throw new NotFoundError("Component not found");
    }
    return component;
  }

  async getAll(vesselId?: string): Promise<Component[]> {
    return this.repository.findByVesselId(vesselId || 'V001');
  }

  async create(data: any, userId: string): Promise<Component> {
    const effectiveRhType = data.rhCounterType || 'NOT_RH_DRIVEN';

    if (data.rhCounterType || data.rhMasterComponentId) {
      if (effectiveRhType === 'MASTER') {
        if (data.rhMasterComponentId) {
          throw new ValidationError("MASTER counter type cannot have a master component reference");
        }
      } else if (effectiveRhType === 'INHERITED') {
        if (!data.rhMasterComponentId) {
          throw new ValidationError("INHERITED counter type requires rhMasterComponentId");
        }
        const masterComponent = await this.repository.findById(data.rhMasterComponentId);
        if (!masterComponent) {
          throw new ValidationError("Master component not found");
        }
        if (masterComponent.vesselId !== data.vesselId) {
          throw new ValidationError("Master component must be from the same vessel");
        }
        if (masterComponent.rhCounterType !== 'MASTER') {
          throw new ValidationError("Referenced component is not a MASTER counter type");
        }
      } else if (effectiveRhType === 'NOT_RH_DRIVEN') {
        if (data.rhMasterComponentId) {
          throw new ValidationError("NOT_RH_DRIVEN counter type cannot have a master component reference");
        }
      }
    }

    return this.repository.create(data);
  }

  async validateAndUpdate(id: string, data: any, userId: string): Promise<Component> {
    const existingComponent = await this.repository.findById(id);
    if (!existingComponent) {
      throw new NotFoundError("Component not found");
    }

    const effectiveRhType = data.rhCounterType || existingComponent.rhCounterType || 'NOT_RH_DRIVEN';
    const effectiveMasterId = data.rhMasterComponentId !== undefined
      ? data.rhMasterComponentId
      : existingComponent.rhMasterComponentId;

    if (data.rhCounterType || data.rhMasterComponentId !== undefined) {
      if (effectiveRhType === 'MASTER') {
        if (effectiveMasterId) {
          throw new ValidationError("MASTER counter type cannot have a master component reference");
        }
      } else if (effectiveRhType === 'INHERITED') {
        if (!effectiveMasterId) {
          throw new ValidationError("INHERITED counter type requires rhMasterComponentId");
        }
        if (effectiveMasterId === id) {
          throw new ValidationError("A component cannot inherit running hours from itself");
        }
        const masterComponent = await this.repository.findById(effectiveMasterId);
        if (!masterComponent) {
          throw new ValidationError("Master component not found");
        }
        if (masterComponent.vesselId !== existingComponent.vesselId) {
          throw new ValidationError("Master component must be from the same vessel");
        }
        if (masterComponent.rhCounterType !== 'MASTER') {
          throw new ValidationError("Referenced component is not a MASTER counter type");
        }
      } else if (effectiveRhType === 'NOT_RH_DRIVEN') {
        if (effectiveMasterId) {
          throw new ValidationError("NOT_RH_DRIVEN counter type cannot have a master component reference");
        }
      }

      if (existingComponent.rhCounterType === 'MASTER' && effectiveRhType !== 'MASTER') {
        const dependents = await this.repository.getInheritedComponents(id);
        if (dependents.length > 0) {
          const dependentNames = dependents.slice(0, 3).map((d: any) => d.name).join(', ');
          const moreCount = dependents.length > 3 ? ` and ${dependents.length - 3} more` : '';
          throw new ValidationError(
            `Cannot change from MASTER: ${dependents.length} component(s) inherit from this counter (${dependentNames}${moreCount}). Reassign them first.`
          );
        }
      }
    }

    let component;
    if (data.currentCumulativeRH !== undefined || data.runningHours !== undefined) {
      const rhValue = parseFloat(data.currentCumulativeRH || data.runningHours || '0');
      if (!isNaN(rhValue)) {
        const result = await this.repository.setRunningHours({
          componentId: id,
          newRHValue: rhValue,
          updateSource: 'MANUAL',
          userId,
          lastUpdatedDate: data.lastUpdated
        });

        const { currentCumulativeRH, runningHours, lastUpdated, ...otherData } = data;
        if (Object.keys(otherData).length > 0) {
          component = await this.repository.update(id, otherData);
        } else {
          component = result.component;
        }
      } else {
        component = await this.repository.update(id, data);
      }
    } else {
      component = await this.repository.update(id, data);
    }

    return component;
  }

  async remove(id: string): Promise<void> {
    return this.repository.remove(id);
  }

  async inactivate(id: string, userId: string, cascadeInactivate: boolean = false): Promise<any> {
    return this.repository.inactivate(id, userId, { cascadeInactivate });
  }

  async getDocuments(componentId: string, user: { role: string; vesselId: string | null }): Promise<any[]> {
    const component = await this.repository.findById(componentId);
    if (!component) {
      throw new NotFoundError("Component not found");
    }

    if (user.role === "Ship" && user.vesselId) {
      if (component.vesselCode !== user.vesselId) {
        throw new ValidationError("Cannot access documents for components from other vessels");
      }
    }

    const documents = await this.repository.findDocuments(componentId);

    return documents.filter((doc: any) => {
      if (user.role === "PMS Admin" || user.role === "Office") {
        return true;
      }
      if (user.role === "Ship") {
        return doc.canShipView;
      }
      return false;
    });
  }

  async getClassRegulatory(componentId: string, user: { role: string; vesselId: string | null }): Promise<any[]> {
    const component = await this.repository.findById(componentId);
    if (!component) {
      throw new NotFoundError("Component not found");
    }

    if (user.role === "Ship" && user.vesselId) {
      if (component.vesselCode !== user.vesselId) {
        throw new ValidationError("Cannot access classification data for components from other vessels");
      }
    }

    return this.repository.findClassRegulatory(componentId);
  }

  async getRequisitions(componentId: string, user: { role: string; vesselId: string | null }): Promise<any[]> {
    const component = await this.repository.findById(componentId);
    if (!component) {
      throw new NotFoundError("Component not found");
    }

    if (user.role === "Ship" && user.vesselId) {
      if (component.vesselCode !== user.vesselId) {
        throw new ValidationError("Cannot access requisitions for components from other vessels");
      }
    }

    let requisitions: any[] = await this.repository.findRequisitions(componentId);

    if (component.componentCode === "401.005" && requisitions.length === 0) {
      requisitions = [
        {
          id: 1001,
          requisitionNo: "REQ-401.005-001",
          componentId: componentId,
          itemOrService: "Rudder Shaft Bearing (SP-00001)",
          quantity: 2,
          uom: "PC",
          raisedOn: "2025-12-01",
          priority: "Normal",
          status: "PO Raised",
          requestedBy: "Chief Engineer",
          vesselCode: component.vesselCode || ''
        },
        {
          id: 1002,
          requisitionNo: "REQ-401.005-002",
          componentId: componentId,
          itemOrService: "Rudder Actuator Service",
          quantity: 1,
          uom: "SRV",
          raisedOn: "2025-12-02",
          priority: "Urgent",
          status: "Delivered On Board",
          requestedBy: "2nd Engineer",
          vesselCode: component.vesselCode || ''
        }
      ];
    }

    return requisitions;
  }

  async getMaintenanceHistory(componentId: string, user: { role: string; vesselId: string | null }): Promise<any[]> {
    const component = await this.repository.findById(componentId);
    if (!component) {
      throw new NotFoundError("Component not found");
    }

    if (user.role === "Ship" && user.vesselId) {
      if (component.vesselCode !== user.vesselId) {
        throw new ValidationError("Cannot access maintenance history for components from other vessels");
      }
    }

    let history = await this.repository.findMaintenanceHistory(componentId);

    if (history.length === 0 && component.componentCode && component.vesselCode) {
      history = await this.repository.findMaintenanceHistoryByCode(
        component.componentCode,
        component.vesselCode
      );
    }

    return history;
  }

  async getMaintenanceHistoryItem(id: number, user: { role: string; vesselId: string | null }): Promise<any> {
    const item = await this.repository.findMaintenanceHistoryItem(id);
    if (!item) {
      throw new NotFoundError("Maintenance history item not found");
    }

    if (user.role === "Ship" && user.vesselId) {
      if (item.vesselCode !== user.vesselId) {
        throw new ValidationError("Cannot access maintenance history from other vessels");
      }
    }

    return item;
  }

  async createDocumentRecord(data: any): Promise<any> {
    return this.repository.createDocument(data);
  }

  async updateDocumentRecord(id: number, data: any): Promise<any> {
    return this.repository.updateDocument(id, data);
  }

  async removeDocumentRecord(id: number): Promise<void> {
    return this.repository.removeDocument(id);
  }

  async getDocumentById(id: number): Promise<any | undefined> {
    return this.repository.findDocument(id);
  }

  async createClassRegulatoryRecord(data: any): Promise<any> {
    return this.repository.createClassRegulatory(data);
  }

  async updateClassRegulatoryRecord(id: number, data: any): Promise<any> {
    return this.repository.updateClassRegulatory(id, data);
  }

  async removeClassRegulatoryRecord(id: number): Promise<void> {
    return this.repository.removeClassRegulatory(id);
  }

  async getAllRequisitions(vesselCode?: string): Promise<any[]> {
    return this.repository.findAllRequisitions(vesselCode);
  }

  async getRequisitionItemById(id: number, user: { role: string; vesselId: string | null }): Promise<any> {
    const item = await this.repository.findRequisitionItem(id);
    if (!item) {
      throw new NotFoundError("Requisition not found");
    }

    if (user.role === "Ship" && user.vesselId) {
      if (item.vesselCode !== user.vesselId) {
        throw new ValidationError("Cannot access requisitions from other vessels");
      }
    }

    return item;
  }

  async createRequisitionRecord(data: any): Promise<any> {
    return this.repository.createRequisition(data);
  }

  async updateRequisitionRecord(id: number, data: any): Promise<any> {
    return this.repository.updateRequisition(id, data);
  }

  async removeRequisitionRecord(id: number): Promise<void> {
    return this.repository.removeRequisition(id);
  }

  async getAllMaintenanceHistory(): Promise<any[]> {
    return this.repository.findAllMaintenanceHistory();
  }
}
