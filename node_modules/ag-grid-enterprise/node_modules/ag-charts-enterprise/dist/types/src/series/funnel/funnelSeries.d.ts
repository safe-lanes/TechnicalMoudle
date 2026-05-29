import { type AgFunnelSeriesOptions, _ModuleSupport } from 'ag-charts-community';
import { BaseFunnelSeries, type Bounds, type FunnelAnimationData, type FunnelNodeDatum, type FunnelNodeLabelDatum, type FunnelSeriesShapeStyle } from './baseFunnelSeries';
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
    protected barStyle(): FunnelSeriesShapeStyle;
    protected connectorStyle(): FunnelSeriesShapeStyle;
    protected nodeFactory(): _ModuleSupport.Rect;
    protected createLabelData({ datumIndex, rect, yDatum, datum, visible, }: {
        datumIndex: number;
        rect: Bounds;
        barAlongX: boolean;
        yDatum: number;
        datum: any;
        visible: boolean;
    }): FunnelNodeLabelDatum | undefined;
    private getItemStyle;
    protected updateDatumNodes(opts: {
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, FunnelNodeDatum>;
        isHighlight: boolean;
    }): void;
    protected tooltipStyle(datum: unknown, datumIndex: number): Required<import("ag-charts-community").AgFunnelSeriesStyle> & {
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
