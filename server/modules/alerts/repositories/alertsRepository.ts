import { storage } from '../../../storage';

// ── Alert Policies ──

export async function getAlertPolicies() {
  return storage.getAlertPolicies();
}

export async function getAlertPolicy(id: string) {
  return storage.getAlertPolicy(id);
}

export async function updateAlertPolicy(id: string, data: any) {
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

export async function getAlertEvent(id: string) {
  return storage.getAlertEvent(id);
}

export async function getAlertDeliveries(eventId: string) {
  return storage.getAlertDeliveries(eventId);
}

export async function acknowledgeAlertEvent(id: string, userId: string) {
  return storage.acknowledgeAlertEvent(id, userId);
}

export async function createAlertEvent(data: any) {
  return storage.createAlertEvent(data);
}

export async function createAlertDelivery(data: any) {
  return storage.createAlertDelivery(data);
}

// ── Alert Acknowledgements ──

export async function getAlertAcknowledgements(eventUuid: string) {
  return storage.getAlertAcknowledgements(eventUuid);
}

export async function createAlertAcknowledgement(data: any) {
  return storage.createAlertAcknowledgement(data);
}

// ── Alert Engine Queries ──

export async function getExistingAlertDedupeKeys() {
  return storage.getExistingAlertDedupeKeys();
}

export async function getWorkOrdersWithMissedCycles() {
  return storage.getWorkOrdersWithMissedCycles();
}

export async function getAllVesselSpares() {
  return storage.getAllVesselSpares();
}

// SQL-prefiltered candidates for UC2 — only critical spares already below minimum,
// projected to the columns evaluateLowSpares reads (was: every spare of the fleet,
// full rows, every 5 minutes).
export async function getLowCriticalSpareCandidates() {
  return storage.getLowCriticalSpareCandidates();
}

export async function getUnacknowledgedAlertEventsForRole(userRole: string, vesselId?: string | null) {
  return storage.getUnacknowledgedAlertEventsForRole(userRole, vesselId);
}

// ── Alert Config ──

export async function getAlertConfig(vesselId: string) {
  return storage.getAlertConfig(vesselId);
}

export async function createOrUpdateAlertConfig(data: any) {
  return storage.createOrUpdateAlertConfig(data);
}
