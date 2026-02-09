import { storage } from "../../../storage";
import type { Component, InsertComponent } from "@shared/v2/components/schema";

export class ComponentRepository {
  async findByVesselId(vesselId: string): Promise<Component[]> {
    return storage.getComponents(vesselId);
  }

  async findById(id: string): Promise<Component | undefined> {
    return storage.getComponent(id);
  }

  async findByCode(code: string, vesselId: string): Promise<Component | undefined> {
    return storage.getComponentByCode(code, vesselId);
  }

  async create(data: InsertComponent): Promise<Component> {
    return storage.createComponent(data);
  }

  async update(id: string, data: Partial<Component>): Promise<Component> {
    return storage.updateComponent(id, data);
  }

  async remove(id: string): Promise<void> {
    return storage.deleteComponent(id);
  }

  async inactivate(id: string, userId: string, options?: { cascadeInactivate?: boolean }): Promise<any> {
    return storage.inactivateComponent(id, userId, options);
  }

  async bulkUpsert(components: any[]): Promise<{ created: number; updated: number }> {
    return storage.bulkUpsertComponents(components);
  }

  async setRunningHours(params: {
    componentId: string;
    newRHValue: number;
    updateSource: string;
    userId: string;
    lastUpdatedDate?: string;
  }): Promise<any> {
    return storage.setComponentRunningHours(params);
  }

  async getInheritedComponents(masterComponentId: string): Promise<Component[]> {
    return storage.getInheritedComponents(masterComponentId);
  }

  async findDocuments(componentId: string): Promise<any[]> {
    return storage.getComponentDocuments(componentId);
  }

  async findDocument(id: number): Promise<any | undefined> {
    return storage.getComponentDocument(id);
  }

  async createDocument(doc: any): Promise<any> {
    return storage.createComponentDocument(doc);
  }

  async updateDocument(id: number, data: any): Promise<any> {
    return storage.updateComponentDocument(id, data);
  }

  async removeDocument(id: number): Promise<void> {
    return storage.deleteComponentDocument(id);
  }

  async findClassRegulatory(componentId: string): Promise<any[]> {
    return storage.getComponentClassRegulatory(componentId);
  }

  async createClassRegulatory(data: any): Promise<any> {
    return storage.createComponentClassRegulatory(data);
  }

  async updateClassRegulatory(id: number, data: any): Promise<any> {
    return storage.updateComponentClassRegulatory(id, data);
  }

  async removeClassRegulatory(id: number): Promise<void> {
    return storage.deleteComponentClassRegulatory(id);
  }

  async findRequisitions(componentId: string): Promise<any[]> {
    return storage.getComponentRequisitions(componentId);
  }

  async findAllRequisitions(vesselCode?: string): Promise<any[]> {
    return storage.getAllComponentRequisitions(vesselCode);
  }

  async findRequisitionItem(id: number): Promise<any | undefined> {
    return storage.getComponentRequisitionItem(id);
  }

  async createRequisition(data: any): Promise<any> {
    return storage.createComponentRequisition(data);
  }

  async updateRequisition(id: number, data: any): Promise<any> {
    return storage.updateComponentRequisition(id, data);
  }

  async removeRequisition(id: number): Promise<void> {
    return storage.deleteComponentRequisition(id);
  }

  async findMaintenanceHistory(componentId: string): Promise<any[]> {
    return storage.getComponentMaintenanceHistory(componentId);
  }

  async findMaintenanceHistoryByCode(componentCode: string, vesselCode: string): Promise<any[]> {
    return storage.getComponentMaintenanceHistoryByCode(componentCode, vesselCode);
  }

  async findAllMaintenanceHistory(): Promise<any[]> {
    return storage.getAllComponentMaintenanceHistory();
  }

  async findMaintenanceHistoryItem(id: number): Promise<any | undefined> {
    return storage.getComponentMaintenanceHistoryItem(id);
  }
}
