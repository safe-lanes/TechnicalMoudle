import type { BeanStub, ISetFilterParams } from 'ag-grid-community';
import type { SetFilterLocaleTextKey } from './localeText';
export declare function processDataPath(dataPath: string[] | null, treeData: boolean, groupAllowUnbalanced: boolean): (string | null)[] | null;
export declare function translateForSetFilter(bean: BeanStub<any>, key: SetFilterLocaleTextKey, variableValues?: string[]): string;
export declare function applyExcelModeOptions<V>(params: ISetFilterParams<any, V>): void;
export declare function createTreeDataOrGroupingComparator(): (a: [string | null, string[] | null], b: [string | null, string[] | null]) => number;
