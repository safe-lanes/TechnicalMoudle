import * as repo from '../repositories/workOrderRepository';
import { NotFoundError } from '../../shared/errors';

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
  return repo.createExecution(executionData);
}

export async function updateExecution(id: string, body: any) {
  const { insertWorkOrderExecutionSchema } = await import('@shared/schema');
  const partialExecutionSchema = insertWorkOrderExecutionSchema.partial();
  const validatedData = partialExecutionSchema.parse(body);
  return repo.updateExecution(id, validatedData);
}
