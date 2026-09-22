/**
 * Add authenticated actor metadata to a generic Work Order update.
 *
 * `userId` identifies who made the request for audit purposes. `performedBy`
 * is submitted execution data and must only change when the caller explicitly
 * supplies it; an approver or rejector is not the person who performed the job.
 */
export function enrichWorkOrderUpdateWithActor<
  T extends Record<string, any> & { userId?: string },
>(
  body: T,
  actor: string | undefined,
): T {
  if (actor && (!body.userId || body.userId === 'system')) {
    body.userId = actor;
  }
  return body;
}