import { type AgConeFunnelSeriesOptions, _ModuleSupport } from 'ag-charts-community';
import { BaseFunnelSeries, type Bounds, type FunnelNodeDatum, type FunnelNodeLabelDatum, type FunnelSeriesShapeStyle } from '../funnel/baseFunnelSeries';
import { ConeFunnelProperties } from './coneFunnelProperties';
export declare class ConeFunnelSeries extends BaseFunnelSeries<_ModuleSupport.Line, AgConeFunnelSeriesOptions> {
    static readonly className = "ConeFunnelSeries";
    static readonly type: "cone-funnel";
    properties: ConeFunnelProperties;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    get hasData(): boolean;
    getBandScalePadding(): {
        inner: number;
        outer: number;
    };
    protected connectorEnabled(): boolean;
    protected barStyle(): FunnelSeriesShapeStyle;
    protected connectorStyle(): FunnelSeriesShapeStyle;
    protected nodeFactory(): _ModuleSupport.Line;
    protected createLabelData({ datumIndex, rect, barAlongX, yDatum, datum, visible, }: {
        datumIndex: number;
        rect: Bounds;
        barAlongX: boolean;
        yDatum: number;
        datum: any;
        visible: boolean;
    }): FunnelNodeLabelDatum | undefined;
    protected updateDatumNodes(opts: {
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Line, FunnelNodeDatum>;
        isHighlight: boolean;
    }): void;
    protected tooltipStyle(_datum: any, datumIndex: number): {
        fill: import("ag-charts-community").AgColorType;
        fillOpacity: number;
        stroke: string;
        strokeOpacity: number;
        strokeWidth: number;
        lineDash: number[];
        lineDashOffset: number;
    };
    protected hasItemStylers(): boolean;
}
