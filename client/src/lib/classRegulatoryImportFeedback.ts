/** Section H's request adapter throws HTTP status + JSON; keep that out of toasts. */
export function classRegulatoryImportFeedback(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  const http = /^(\d{3}):\s*([\s\S]*)$/.exec(message);
  if (!http) return message || fallback;
  if (Number(http[1]) >= 500) return "Validation is temporarily unavailable. Retry, or contact your administrator if the problem continues.";
  try {
    const body = JSON.parse(http[2]);
    return typeof body.error === "string" ? body.error : typeof body.message === "string" ? body.message : fallback;
  } catch { return fallback; }
}
