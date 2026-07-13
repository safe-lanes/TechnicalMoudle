import type { AgBoxPlotHighlightStyleOptions } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import { type DeepRequired } from 'ag-charts-core';
import type { BoxPlotNodeDatum } from './boxPlotTypes';
declare const ScalableGroup: typeof _ModuleSupport.ScalableGroup;
export declare class BoxPlotGroup extends ScalableGroup implements _ModuleSupport.DistantObject {
    constructor();
    updateDatumStyles(datum: BoxPlotNodeDatum, activeStyles: DeepRequired<AgBoxPlotHighlightStyleOptions>, isVertical: boolean, isReversedValueAxis: boolean | undefined, fillBBox?: _ModuleSupport.ShapeFillBBox): void;
    distanceSquared(x: number, y: number): number;
    get midPoint(): {
        x: number;
        y: number;
    };
}
export {};
