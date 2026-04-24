import * as repo from '../repositories/workOrderRepository';
import { NotFoundError, ValidationError } from '../../shared/errors';
import { linkDocumentsToExecution } from './woDocumentService';
import { isCompletedStatus } from '../../../utils/workOrderStatus';
import { logFieldChanges } from '../../sync';

export async function getExecutions(componentId: string) {
  return repo.findExecutions(componentId);
}

export async function getExecution(id: string) {
  const execution = await repo.findExecutionById(id);
  if (!execution) {
    throw new NotFoundError('Work order execution not found');
  }
  return execution;
}

export async function createExecution(body: any) {
  if (body.workOrderId) {
    const wo = await repo.findById(body.workOrderId);
    if (wo && isCompletedStatus(wo.status)) {
      throw new ValidationError('Editing is not allowed because the Work Order is completed.');
    }
  }

  const { insertWorkOrderExecutionSchema } = await import('@shared/schema');
  const executionData = insertWorkOrderExecutionSchema.parse(body);
  const execution = await repo.createExecution(executionData);

  // Sync field logging — log execution INSERT
  try {
    const vesselId = (execution as any).vesselId || body.vesselId || null;
    await logFieldChanges('work_order_executions', (execution as any).id, vesselId, null, execution, body.performedBy || 'system');
  } catch (err) { console.error('[FieldLogger] WOExec create:', err); }

  if (execution && execution.templateId && execution.id) {
    try {
      await linkDocumentsToExecution(execution.templateId, execution.id);
    } catch (linkErr) {
      console.error('Failed to link documents to execution:', linkErr);
    }
  }

  return execution;
}

export async function updateExecution(id: string, body: any) {
  const existing = await repo.findExecutionById(id);
  if (existing) {
    const templateId = (existing as any).templateId || (existing as any).template_id;
    if (templateId) {
      const wo = await repo.findById(templateId);
      if (wo && isCompletedStatus(wo.status)) {
        throw new ValidationError('Editing is not allowed because the Work Order is completed.');
      }
    }
  }

  const { insertWorkOrderExecutionSchema } = await import('@shared/schema');
  const partialExecutionSchema = insertWorkOrderExecutionSchema.partial();
  const validatedData = partialExecutionSchema.parse(body);
  const updated = await repo.updateExecution(id, validatedData);

  // Sync field logging — log execution UPDATE (existing already fetched above)
  if (existing && updated) {
    try {
      await logFieldChanges('work_order_executions', (existing as any).id, (existing as any).vesselId || null, existing, updated, body.performedBy || 'system');
    } catch (err) { console.error('[FieldLogger] WOExec update:', err); }
  }

  return updated;
}
