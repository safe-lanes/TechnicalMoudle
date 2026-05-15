import type { ScaleType } from '../../../scale/scale';
export interface BarSeriesDataAggregationFilter {
    maxRange: number;
    positiveIndices: number[];
    positiveIndexData: Int32Array;
    negativeIndices: number[];
    negativeIndexData: Int32Array;
}
export declare function aggregateBarData(scale: ScaleType, xValues: any[], yStartValues: any[] | undefined, yEndValues: any[], domain: number[], smallestKeyInterval: number | undefined): BarSeriesDataAggregationFilter[] | undefined;
