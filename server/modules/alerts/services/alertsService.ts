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

export async function acknowledgeEvent(id: string, userId: string, userRole?: string, comments?: string) {
  const event = await alertsRepo.getAlertEvent(id);
  if (!event) {
    throw new NotFoundError('Alert event not found');
  }

  // Check if this is a co-ack alert (UC3 skipped cycles)
  const payload = JSON.parse(event.payload || '{}');
  const requiresCoAck = payload.requiresCoAck === true;

  if (requiresCoAck) {
    // Co-ack: add acknowledgement record (mandatory comments)
    if (!comments || comments.trim().length === 0) {
      throw new Error('Comments are mandatory for co-acknowledgement of skipped cycle alerts');
    }
    if (!userRole) {
      throw new Error('User role is required for co-acknowledgement');
    }

    await alertsRepo.createAlertAcknowledgement({
      eventUuid: id,
      userId,
      userRole,
      comments: comments.trim(),
    });

    // Check if all required roles have acknowledged
    const acks = await alertsRepo.getAlertAcknowledgements(id);
    const coAckRoles: string[] = payload.coAckRoles || ['Chief Engineer', 'Technical Superintendent'];
    const ackedRoles = new Set(acks.map((a: any) => a.userRole));

    // Admin roles count as Technical Superintendent
    const adminRoles = ['PMS Admin', 'Sail Admin', 'Super Admin'];
    for (const ack of acks) {
      if (adminRoles.includes(ack.userRole)) {
        ackedRoles.add('Technical Superintendent');
      }
    }
    // Ship role can count as Chief Engineer for co-ack purposes
    if (ackedRoles.has('Ship') || ackedRoles.has('Vessel Admin')) {
      ackedRoles.add('Chief Engineer');
    }

    const allAcked = coAckRoles.every(role => ackedRoles.has(role));
    if (allAcked) {
      // Fully acknowledged — mark event as acknowledged
      return alertsRepo.acknowledgeAlertEvent(id, userId);
    }

    // Partial ack — return the event with ack status
    return { ...event, partialAck: true, acknowledgements: acks };
  }

  // Simple ack (UC1, UC2)
  return alertsRepo.acknowledgeAlertEvent(id, userId);
}

export async function getAcknowledgements(eventId: string) {
  return alertsRepo.getAlertAcknowledgements(eventId);
}

export async function getEventsForCurrentUser(userRole: string, vesselId?: string | null) {
  return alertsRepo.getUnacknowledgedAlertEventsForRole(userRole, vesselId);
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
