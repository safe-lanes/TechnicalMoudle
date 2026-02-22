import { storage } from '../../../storage';

// ── Alert Policies ──

export async function getAlertPolicies() {
  return storage.getAlertPolicies();
}

export async function getAlertPolicy(id: number) {
  return storage.getAlertPolicy(id);
}

export async function updateAlertPolicy(id: number, data: any) {
  return storage.updateAlertPolicy(id, data);
}

// ── Alert Events ──

export async function getAlertEvents(filters: {
  startDate?: Date;
  endDate?: Date;
  alertType?: string;
  priority?: string;
  status?: string;
  vesselId?: string;
}) {
  return storage.getAlertEvents(filters);
}

export async function getAlertEvent(id: number) {
  return storage.getAlertEvent(id);
}

export async function getAlertDeliveries(eventId: number) {
  return storage.getAlertDeliveries(eventId);
}

export async function acknowledgeAlertEvent(id: number, userId: string) {
  return storage.acknowledgeAlertEvent(id, userId);
}

export async function createAlertEvent(data: any) {
  return storage.createAlertEvent(data);
}

export async function createAlertDelivery(data: any) {
  return storage.createAlertDelivery(data);
}

// ── Alert Config ──

export async function getAlertConfig(vesselId: string) {
  return storage.getAlertConfig(vesselId);
}

export async function createOrUpdateAlertConfig(data: any) {
  return storage.createOrUpdateAlertConfig(data);
}
