import type { RowNode } from 'ag-grid-community';
import { AgPromise } from 'ag-grid-community';
import { BeanStub } from 'ag-grid-community';
/** @param V type of value in the Set Filter */
export declare class ClientSideValuesExtractor<V> extends BeanStub {
    private readonly createKey;
    private readonly caseFormat;
    private readonly getValue;
    private readonly isTreeDataOrGrouping;
    private readonly isTreeData;
    constructor(createKey: (value: V | null | undefined, node?: RowNode) => string | null, caseFormat: <T extends string | null>(valueToFormat: T) => typeof valueToFormat, getValue: (node: RowNode) => V | null | undefined, isTreeDataOrGrouping: () => boolean, isTreeData: () => boolean);
    extractUniqueValuesAsync(predicate: (node: RowNode) => boolean, existingValues?: Map<string | null, V | null>): AgPromise<Map<string | null, V | null>>;
    extractUniqueValues(predicate: (node: RowNode) => boolean, existingValues?: Map<string | null, V | null>): Map<string | null, V | null>;
    private addValueForTreeDataOrGrouping;
    private extractExistingFormattedKeys;
}
