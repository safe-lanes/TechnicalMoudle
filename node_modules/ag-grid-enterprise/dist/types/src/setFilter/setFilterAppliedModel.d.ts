import type { SetFilterModel } from 'ag-grid-community';
export declare class SetFilterAppliedModel {
    private readonly caseFormat;
    private keys;
    constructor(caseFormat: <T extends string | null>(valueToFormat: T) => T);
    /** No model applied */
    isNull(): boolean;
    /** Nothing selected */
    isEmpty(): boolean;
    update(appliedModel: SetFilterModel | null): void;
    has(key: string | null): boolean;
    destroy(): void;
}
