import { type AgFunnelSeriesOptions, type AgFunnelSeriesStyle, _ModuleSupport } from 'ag-charts-community';
import type { RequireOptional } from 'ag-charts-core';
import { BaseFunnelSeries, type Bounds, type FunnelAnimationData, type FunnelNodeDatum, type FunnelNodeLabelDatum } from './baseFunnelSeries';
import { FunnelProperties } from './funnelProperties';
export declare class FunnelSeries extends BaseFunnelSeries<_ModuleSupport.Rect<FunnelNodeDatum>, AgFunnelSeriesOptions> {
    static readonly className = "FunnelSeries";
    static readonly type: "funnel";
    properties: FunnelProperties;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    getBandScalePadding(): {
        inner: number;
        outer: number;
    };
    protected connectorEnabled(): boolean;
    protected connectorStyle(index: number): RequireOptional<AgFunnelSeriesStyle> & {
        opacity: number;
    };
    protected nodeFactory(): _ModuleSupport.Rect;
    protected createLabelData({ datumIndex, rect, yDatum, datum, visible, }: {
        datumIndex: number;
        rect: Bounds;
        barAlongX: boolean;
        yDatum: number;
        datum: any;
        visible: boolean;
    }): FunnelNodeLabelDatum | undefined;
    protected getItemStyle({ datum, datumIndex }: Pick<FunnelNodeDatum, 'datum' | 'datumIndex'>, isHighlight: boolean): Required<AgFunnelSeriesStyle> & {
        opacity: number;
    } & Partial<AgFunnelSeriesOptions<any, unknown> & {
        fill: import("ag-charts-community").AgColorType;
        fillOpacity: number;
        stroke: string;
        strokeWidth: number;
        strokeOpacity: number;
        lineDash: number[];
        lineDashOffset: number;
        opacity: number;
    }>;
    protected updateDatumNodes({ datumSelection, isHighlight, }: {
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, FunnelNodeDatum>;
        isHighlight: boolean;
    }): void;
    protected tooltipStyle(datum: unknown, datumIndex: number): Required<AgFunnelSeriesStyle> & {
        opacity: number;
    } & Partial<AgFunnelSeriesOptions<any, unknown> & {
        fill: import("ag-charts-community").AgColorType;
        fillOpacity: number;
        stroke: string;
        strokeWidth: number;
        strokeOpacity: number;
        lineDash: number[];
        lineDashOffset: number;
        opacity: number;
    }>;
    animateEmptyUpdateReady(params: FunnelAnimationData<_ModuleSupport.Rect>): void;
    animateWaitingUpdateReady(data: FunnelAnimationData<_ModuleSupport.Rect>): void;
    protected hasItemStylers(): boolean;
}
