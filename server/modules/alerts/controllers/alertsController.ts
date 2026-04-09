import { Request, Response } from 'express';
import * as alertsService from '../services/alertsService';

// ── GET /alerts/policies ──

export async function getPolicies(req: Request, res: Response) {
  const policies = await alertsService.getPolicies();
  res.json(policies);
}

// ── GET /alerts/policies/:id ──

export async function getPolicy(req: Request, res: Response) {
  const id = req.params.id;
  const policy = await alertsService.getPolicy(id);
  res.json(policy);
}

// ── PATCH /alerts/policies/:id ──

export async function updatePolicy(req: Request, res: Response) {
  const id = req.params.id;
  const policy = await alertsService.updatePolicy(id, req.body);
  res.json(policy);
}

// ── POST /alerts/policies/batch-update ──

export async function batchUpdatePolicies(req: Request, res: Response) {
  const results = await alertsService.batchUpdatePolicies(req.body.policies);
  res.json({ success: true, policies: results });
}

// ── GET /alerts/events ──

export async function getEvents(req: Request, res: Response) {
  const events = await alertsService.getEvents({
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
    alertType: req.query.alertType as string | undefined,
    priority: req.query.priority as string | undefined,
    status: req.query.status as string | undefined,
    vesselId: req.query.vesselId as string | undefined,
  });
  res.json(events);
}

// ── GET /alerts/events/:id ──

export async function getEvent(req: Request, res: Response) {
  const id = req.params.id;
  const event = await alertsService.getEvent(id);
  res.json(event);
}

// ── POST /alerts/events/:id/acknowledge ──

export async function acknowledgeEvent(req: Request, res: Response) {
  const id = req.params.id;
  const user = (req as any).user;
  const userId = req.body.userId || user?.userUuid || 'user1';
  const userRole = req.body.userRole || user?.role || 'Office';
  const comments = req.body.comments;
  const event = await alertsService.acknowledgeEvent(id, userId, userRole, comments);
  res.json(event);
}

// ── GET /alerts/events/:id/acknowledgements ──

export async function getAcknowledgements(req: Request, res: Response) {
  const id = req.params.id;
  const acks = await alertsService.getAcknowledgements(id);
  res.json(acks);
}

// ── GET /alerts/events/for-current-user ──

export async function getEventsForCurrentUser(req: Request, res: Response) {
  const user = (req as any).user;
  const userRole = (req.query.role as string) || user?.role || 'Office';
  const vesselId = (req.query.vesselId as string) || user?.vesselId || null;
  const events = await alertsService.getEventsForCurrentUser(userRole, vesselId);
  res.json(events);
}

// ── POST /alerts/test ──

export async function sendTestAlert(req: Request, res: Response) {
  const { policyId, userId } = req.body;
  const event = await alertsService.sendTestAlert(policyId, userId);
  res.json({ success: true, event });
}

// ── GET /alerts/config/:vesselId ──

export async function getConfig(req: Request, res: Response) {
  const config = await alertsService.getConfig(req.params.vesselId);
  res.json(config);
}

// ── POST /alerts/config ──

export async function updateConfig(req: Request, res: Response) {
  const config = await alertsService.updateConfig(req.body);
  res.json(config);
}
