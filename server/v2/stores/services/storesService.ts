import { StoresRepository } from "../repositories/storesRepository";
import type { V2StoresItem, V2InsertStoresItem, V2StoresLedger } from "@shared/v2/stores/schema";

export class StoresService {
  constructor(private repository: StoresRepository) {}

  async getStoresItems(vesselId: string, itemType?: string): Promise<V2StoresItem[]> {
    return this.repository.getStoresItems(vesselId, itemType);
  }

  async getStoresItem(id: number): Promise<V2StoresItem | undefined> {
    return this.repository.getStoresItem(id);
  }

  async createStoresItem(item: V2InsertStoresItem, userId?: string): Promise<V2StoresItem> {
    return this.repository.createStoresItem(item, userId);
  }

  async updateStoresItem(id: number, data: Partial<V2StoresItem>): Promise<V2StoresItem> {
    return this.repository.updateStoresItem(id, data);
  }

  async deleteStoresItem(id: number): Promise<void> {
    return this.repository.deleteStoresItem(id);
  }

  async consumeStoresItem(
    id: number,
    quantity: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<V2StoresItem> {
    return this.repository.consumeStoresItem(id, quantity, location, userId, remarks, place, dateLocal, tz);
  }

  async receiveStoresItem(
    id: number,
    quantity: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    ref?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<V2StoresItem> {
    return this.repository.receiveStoresItem(id, quantity, location, userId, remarks, ref, place, dateLocal, tz);
  }

  async transferStoresItemLocation(
    id: number,
    newRobLocationA: string,
    newRobLocationB: string,
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<{ item: V2StoresItem; isTransfer: boolean }> {
    return this.repository.transferStoresItemLocation(id, newRobLocationA, newRobLocationB, userId, remarks, place, dateLocal, tz);
  }

  async adjustStoresItem(
    id: number,
    newRob: number,
    location: 'A' | 'B',
    userId: string,
    remarks?: string,
    place?: string,
    dateLocal?: string,
    tz?: string
  ): Promise<V2StoresItem> {
    return this.repository.adjustStoresItem(id, newRob, location, userId, remarks, place, dateLocal, tz);
  }

  async getStoresTransactionHistory(vesselId: string, itemType?: string): Promise<V2StoresLedger[]> {
    return this.repository.getStoresTransactionHistory(vesselId, itemType);
  }

  async getStoresItemHistory(itemId: number): Promise<V2StoresLedger[]> {
    return this.repository.getStoresItemHistory(itemId);
  }
}
