import * as repo from '../repositories/workOrderRepository';
import { NotFoundError } from '../../shared/errors';
import { linkDocumentsToExecution } from './woDocumentService';

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
  const { insertWorkOrderExecutionSchema } = await import('@shared/schema');
  const executionData = insertWorkOrderExecutionSchema.parse(body);
  const execution = await repo.createExecution(executionData);

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
  const { insertWorkOrderExecutionSchema } = await import('@shared/schema');
  const partialExecutionSchema = insertWorkOrderExecutionSchema.partial();
  const validatedData = partialExecutionSchema.parse(body);
  return repo.updateExecution(id, validatedData);
}
