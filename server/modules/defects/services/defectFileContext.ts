import { AsyncLocalStorage } from 'node:async_hooks';
/** Used only for the external-file save path; existing inline writes stay unchanged. */
export const defectFileCommitContext = new AsyncLocalStorage<{
  tx: any; duuid: string; actorUuid: string;
}>();
