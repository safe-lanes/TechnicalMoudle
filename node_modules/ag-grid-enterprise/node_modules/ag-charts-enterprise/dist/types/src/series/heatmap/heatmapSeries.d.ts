import type { AgHeatmapSeriesOptions, FontStyle, FontWeight, TextAlign, VerticalAlign } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import { HeatmapSeriesProperties } from './heatmapSeriesProperties';
interface HeatmapNodeDatum extends _ModuleSupport.CartesianSeriesNodeDatum {
    readonly point: Readonly<_ModuleSupport.SizedPoint>;
    midPoint: Readonly<_ModuleSupport.Point>;
    readonly width: number;
    readonly height: number;
    readonly colorValue: any;
}
interface HeatmapLabelDatum extends _ModuleSupport.Point {
    datumIndex: number;
    series: _ModuleSupport.CartesianSeriesNodeDatum['series'];
    datum: any;
    itemId?: string;
    text: string;
    fontSize: number;
    lineHeight: number;
    fontStyle: FontStyle | undefined;
    fontFamily: string;
    fontWeight: FontWeight | undefined;
    color: string | undefined;
    textAlign: TextAlign;
    textBaseline: VerticalAlign;
}
declare class HeatmapSeriesNodeEvent<TEvent extends string = _ModuleSupport.SeriesNodeEventTypes> extends _ModuleSupport.CartesianSeriesNodeEvent<TEvent> {
    readonly colorKey?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: HeatmapNodeDatum, series: HeatmapSeries);
}
export declare class HeatmapSeries extends _ModuleSupport.CartesianSeries<_ModuleSupport.Rect, AgHeatmapSeriesOptions, HeatmapSeriesProperties, HeatmapNodeDatum, HeatmapLabelDatum> {
    static readonly className = "HeatmapSeries";
    static readonly type: "heatmap";
    properties: HeatmapSeriesProperties;
    protected readonly NodeEvent: typeof HeatmapSeriesNodeEvent;
    readonly colorScale: _ModuleSupport.ColorScale;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    private isColorScaleValid;
    xCoordinateRange(xValue: any, pixelSize: number): [number, number];
    yCoordinateRange(yValues: any[], pixelSize: number): [number, number];
    getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[];
    getSeriesRange(_direction: _ModuleSupport.ChartAxisDirection, _visibleRange: [any, any]): [number, number];
    createNodeData(): {
        itemId: string;
        nodeData: HeatmapNodeDatum[];
        labelData: HeatmapLabelDatum[];
        scales: {
            x?: _ModuleSupport.Scaling | undefined;
            y?: _ModuleSupport.Scaling | undefined;
            angle?: _ModuleSupport.Scaling | undefined;
            radius?: _ModuleSupport.Scaling | undefined;
        };
        visible: boolean;
    } | undefined;
    protected nodeFactory(): _ModuleSupport.Rect<any>;
    update(params: {
        seriesRect?: _ModuleSupport.BBox;
    }): void;
    protected updateDatumSelection(opts: {
        nodeData: HeatmapNodeDatum[];
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, HeatmapNodeDatum>;
    }): _ModuleSupport.Selection<_ModuleSupport.Rect<any>, HeatmapNodeDatum>;
    protected getItemStyle({ datumIndex, datum, colorValue }: Partial<HeatmapNodeDatum>, isHighlight: boolean): Partial<AgHeatmapSeriesOptions<any, unknown> & {
        fill: import("ag-charts-community").AgColorType;
        fillOpacity: number;
        stroke: string;
        strokeWidth: number;
        strokeOpacity: number;
        lineDash: number[];
        lineDashOffset: number;
        opacity: number;
    }> & {
        fill: string;
        fillOpacity: number;
        stroke: string;
        strokeWidth: number;
        strokeOpacity: number;
        opacity: number;
    };
    protected updateDatumNodes(opts: {
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, HeatmapNodeDatum>;
        isHighlight: boolean;
    }): void;
    protected updateLabelSelection(opts: {
        labelData: HeatmapLabelDatum[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, HeatmapLabelDatum>;
    }): _ModuleSupport.Selection<_ModuleSupport.Text<any>, HeatmapLabelDatum>;
    protected updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, HeatmapLabelDatum>;
    }): void;
    getTooltipContent(datumIndex: number): _ModuleSupport.TooltipContent | undefined;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.GradientLegendDatum[];
    protected isLabelEnabled(): boolean;
    getBandScalePadding(): {
        inner: number;
        outer: number;
    };
    protected computeFocusBounds({ datumIndex }: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined;
    protected initQuadTree(quadtree: _ModuleSupport.QuadtreeNearest<HeatmapNodeDatum>): void;
    protected pickNodesExactShape(point: _ModuleSupport.Point): _ModuleSupport.SeriesNodeDatum<unknown>[];
    protected pickNodeClosestDatum(point: _ModuleSupport.Point): _ModuleSupport.SeriesNodePickMatch | undefined;
    protected hasItemStylers(): boolean;
}
export {};
