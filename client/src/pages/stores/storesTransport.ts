/** Fetch-only transport, kept independent of React/JSX for contract tests. */
export async function storesJson(url: string, body?: unknown, signal?: AbortSignal) {
  const json = body === undefined ? undefined : JSON.stringify(body);
  // Match the existing Express parser ceiling; never split bulk actions silently.
  const tooLarge = "The Stores request exceeds the server's existing size limit. Keep your pending edits and use a smaller explicit selection; no automatic retry was attempted.";
  const write = /\/(?:targets\/inactivate|chemicals\/update|bulk-quantities)(?:\?|$)/.test(url);
  const uncertain = "The request may already have been applied. Pending edits were kept; check the latest results before retrying. No automatic retry was attempted.";
  if (json !== undefined && new Blob([json]).size > 100 * 1024 * 1024) throw new Error(tooLarge);
  let response: Response;
  try {
    response = await fetch(url, { signal, ...(json !== undefined ? { method: "POST", headers: { "Content-Type": "application/json" }, body: json } : {}) });
  } catch (error) {
    if (write) throw new Error(uncertain);
    throw error;
  }
  if (!response.ok) {
    if (response.status === 413) throw new Error(tooLarge);
    const error = await response.json().catch(() => ({}));
    const message = error.error || error.message || "Stores request failed";
    throw new Error(write && response.status >= 500 ? `${message}. ${uncertain}` : message);
  }
  try { return await response.json(); }
  catch (error) {
    if (write) throw new Error(uncertain);
    throw error;
  }
}
