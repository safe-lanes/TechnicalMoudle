import type { BeanCollection } from 'ag-grid-community';
export declare function startBatchEdit({ editSvc, gos, rowModel }: BeanCollection): void;
export declare function cancelBatchEdit({ editSvc }: BeanCollection): void;
export declare function commitBatchEdit({ editSvc }: BeanCollection): void;
export declare function isBatchEditing(beans: BeanCollection): boolean;
