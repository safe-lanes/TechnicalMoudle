import * as alertsRepo from '../repositories/alertsRepository';
import { NotFoundError } from '../../shared/errors';

// ── Policies ──

export async function getPolicies() {
  return alertsRepo.getAlertPolicies();
}

export async function getPolicy(id: string) {
  const policy = await alertsRepo.getAlertPolicy(id);
  if (!policy) {
    throw new NotFoundError('Alert policy not found');
  }
  return policy;
}

export async function updatePolicy(id: string, data: any) {
  return alertsRepo.updateAlertPolicy(id, data);
}

export async function batchUpdatePolicies(policies: Array<{ id: string; [key: string]: any }>) {
  const results = [];
  for (const update of policies) {
    const policy = await alertsRepo.updateAlertPolicy(update.id, update);
    results.push(policy);
  }
  return results;
}

// ── Events ──

export async function getEvents(filters: {
  startDate?: string;
  endDate?: string;
  alertType?: string;
  priority?: string;
  status?: string;
  vesselId?: string;
}) {
  return alertsRepo.getAlertEvents({
    startDate: filters.startDate ? new Date(filters.startDate) : undefined,
    endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    alertType: filters.alertType,
    priority: filters.priority,
    status: filters.status,
    vesselId: filters.vesselId,
  });
}

export async function getEvent(id: string) {
  const event = await alertsRepo.getAlertEvent(id);
  if (!event) {
    throw new NotFoundError('Alert event not found');
  }
  const deliveries = await alertsRepo.getAlertDeliveries(id);
  return { ...event, deliveries };
}

export async function acknowledgeEvent(id: string, userId: string) {
  return alertsRepo.acknowledgeAlertEvent(id, userId);
}

// ── Test Alert ──

export async function sendTestAlert(policyId: string, userId: string) {
  const policy = await alertsRepo.getAlertPolicy(policyId);
  if (!policy) {
    throw new NotFoundError('Alert policy not found');
  }

  const event = await alertsRepo.createAlertEvent({
    policyId: policy.id,
    policyUuid: policy.apuuid,
    alertType: policy.alertType,
    priority: policy.priority,
    objectType: 'test',
    objectId: 'test-' + Date.now(),
    vesselId: 'V001',
    dedupeKey: `test-${policyId}-${Date.now()}`,
    state: 'test',
    payload: JSON.stringify({
      test: true,
      message: `This is a test alert for ${policy.alertType}`,
      timestamp: new Date().toISOString()
    })
  });

  if (policy.inAppEnabled) {
    await alertsRepo.createAlertDelivery({
      eventId: event.id,
      eventUuid: event.aeuuid,
      channel: 'in_app',
      recipient: userId || 'user1',
      status: 'sent'
    });
  }

  if (policy.emailEnabled) {
    await alertsRepo.createAlertDelivery({
      eventId: event.id,
      eventUuid: event.aeuuid,
      channel: 'email',
      recipient: userId || 'user1@example.com',
      status: 'sent'
    });
  }

  return event;
}

// ── Config ──

export async function getConfig(vesselId: string) {
  const config = await alertsRepo.getAlertConfig(vesselId);
  return config || {
    vesselId,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    escalationEnabled: false,
    escalationHours: 4,
    escalationRecipients: '[]'
  };
}

export async function updateConfig(data: any) {
  return alertsRepo.createOrUpdateAlertConfig({
    ...data,
    updatedBy: data.userId || 'user1'
  });
}
