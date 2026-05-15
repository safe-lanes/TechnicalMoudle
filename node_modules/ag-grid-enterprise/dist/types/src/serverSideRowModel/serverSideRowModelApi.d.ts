import type { BeanCollection, IServerSideGroupSelectionState, IServerSideSelectionState, LoadSuccessParams, RefreshServerSideParams, ServerSideGroupLevelState, ServerSideTransaction, ServerSideTransactionResult } from 'ag-grid-community';
export declare function getServerSideSelectionState(beans: BeanCollection): IServerSideSelectionState | IServerSideGroupSelectionState | null;
export declare function setServerSideSelectionState(beans: BeanCollection, state: IServerSideSelectionState | IServerSideGroupSelectionState): void;
export declare function applyServerSideTransaction<TData = any>(beans: BeanCollection, transaction: ServerSideTransaction<TData>): ServerSideTransactionResult<TData> | undefined;
export declare function applyServerSideRowData<TData = any>(beans: BeanCollection, params: {
    successParams: LoadSuccessParams<TData>;
    route?: string[];
    startRow?: number;
}): void;
export declare function applyServerSideTransactionAsync<TData = any>(beans: BeanCollection, transaction: ServerSideTransaction<TData>, callback?: (res: ServerSideTransactionResult<TData>) => void): void;
export declare function retryServerSideLoads(beans: BeanCollection): void;
export declare function flushServerSideAsyncTransactions(beans: BeanCollection): void;
export declare function refreshServerSide(beans: BeanCollection, params?: RefreshServerSideParams): void;
export declare function getServerSideGroupLevelState(beans: BeanCollection): ServerSideGroupLevelState[];
