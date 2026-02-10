export function generateWorkOrderNumber(): string {
  const randomDigits = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return `WO-${randomDigits}`;
}

export function generateExecutionId(): string {
  const randomDigits = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return `WOE-${randomDigits}`;
}
