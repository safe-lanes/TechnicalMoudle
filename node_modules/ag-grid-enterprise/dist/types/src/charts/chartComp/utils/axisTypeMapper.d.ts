import type { AgCartesianAxisType } from 'ag-charts-types';
import type { ChartType } from 'ag-grid-community';
export declare const ALL_AXIS_TYPES: AgCartesianAxisType[];
export declare function getLegacyAxisType(chartType: ChartType): [AgCartesianAxisType, AgCartesianAxisType] | undefined;
