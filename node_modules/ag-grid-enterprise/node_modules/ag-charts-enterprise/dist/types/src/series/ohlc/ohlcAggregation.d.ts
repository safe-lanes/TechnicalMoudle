import { _ModuleSupport } from 'ag-charts-community';
declare const AGGREGATION_SPAN: number;
export declare const OPEN = 0;
export declare const HIGH = 3;
export declare const LOW = 2;
export declare const CLOSE = 1;
export { AGGREGATION_SPAN as SPAN };
export interface OhlcSeriesDataAggregationFilter {
    indexData: Int32Array;
    maxRange: number;
}
export declare function aggregateOhlcData(scale: _ModuleSupport.ScaleType, xValues: any[], highValues: any[], lowValues: any[], domain: number[]): OhlcSeriesDataAggregationFilter[] | undefined;
