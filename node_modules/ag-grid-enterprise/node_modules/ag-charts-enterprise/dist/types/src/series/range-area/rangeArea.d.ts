import { type AgRangeAreaSeriesOptions, type AgSeriesMarkerStyle, _ModuleSupport } from 'ag-charts-community';
import { type RangeAreaMarkerDatum, RangeAreaProperties } from './rangeAreaProperties';
import { type RangeAreaContext, type RangeAreaLabelDatum } from './rangeAreaUtil';
declare class RangeAreaSeriesNodeEvent<TEvent extends string = _ModuleSupport.SeriesNodeEventTypes> extends _ModuleSupport.SeriesNodeEvent<RangeAreaMarkerDatum, TEvent> {
    readonly xKey?: string;
    readonly yLowKey?: string;
    readonly yHighKey?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: RangeAreaMarkerDatum, series: RangeAreaSeries);
}
export declare class RangeAreaSeries extends _ModuleSupport.CartesianSeries<_ModuleSupport.Marker, AgRangeAreaSeriesOptions, RangeAreaProperties, RangeAreaMarkerDatum, RangeAreaLabelDatum, RangeAreaContext> {
    static readonly className = "RangeAreaSeries";
    static readonly type: "range-area";
    properties: RangeAreaProperties;
    protected readonly NodeEvent: typeof RangeAreaSeriesNodeEvent;
    private dataAggregationFilters;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    private aggregateData;
    xCoordinateRange(xValue: any): [number, number];
    yCoordinateRange(yValues: any[]): [number, number];
    getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[];
    getSeriesRange(_direction: _ModuleSupport.ChartAxisDirection, visibleRange: [any, any]): any[];
    createNodeData(): RangeAreaContext | undefined;
    private createLabelData;
    protected isPathOrSelectionDirty(): boolean;
    protected updatePathNodes(opts: {
        paths: _ModuleSupport.Path[];
        visible: boolean;
        animationEnabled: boolean;
    }): void;
    protected updatePaths(opts: {
        contextData: RangeAreaContext;
        paths: _ModuleSupport.Path[];
    }): void;
    private updateAreaPaths;
    private updateFillPath;
    private updateStrokePath;
    protected updateDatumSelection(opts: {
        nodeData: RangeAreaMarkerDatum[];
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Marker, RangeAreaMarkerDatum>;
    }): _ModuleSupport.Selection<_ModuleSupport.Marker, RangeAreaMarkerDatum>;
    protected updateDatumNodes(opts: {
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Marker, RangeAreaMarkerDatum>;
        isHighlight: boolean;
    }): void;
    protected updateLabelSelection(opts: {
        labelData: RangeAreaLabelDatum[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, RangeAreaLabelDatum>;
    }): _ModuleSupport.Selection<_ModuleSupport.Text<any>, RangeAreaLabelDatum>;
    protected updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, RangeAreaLabelDatum>;
    }): void;
    protected getHighlightLabelData(labelData: RangeAreaLabelDatum[], highlightedItem: RangeAreaMarkerDatum): RangeAreaLabelDatum[] | undefined;
    protected getHighlightData(nodeData: RangeAreaMarkerDatum[], highlightedItem: RangeAreaMarkerDatum): RangeAreaMarkerDatum[] | undefined;
    getTooltipContent(datumIndex: number, removeThisDatum: RangeAreaMarkerDatum | undefined): _ModuleSupport.TooltipContent | undefined;
    private legendItemSymbol;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[];
    protected isLabelEnabled(): boolean;
    onDataChange(): void;
    protected nodeFactory(): _ModuleSupport.Marker;
    animateEmptyUpdateReady(animationData: _ModuleSupport.CartesianAnimationData<_ModuleSupport.Marker, RangeAreaMarkerDatum, RangeAreaLabelDatum, RangeAreaContext>): void;
    protected animateReadyResize(animationData: _ModuleSupport.CartesianAnimationData<_ModuleSupport.Marker, RangeAreaMarkerDatum, RangeAreaLabelDatum, RangeAreaContext>): void;
    animateWaitingUpdateReady(animationData: _ModuleSupport.CartesianAnimationData<_ModuleSupport.Marker, RangeAreaMarkerDatum, RangeAreaLabelDatum, RangeAreaContext>): void;
    getFormattedMarkerStyle(datum: RangeAreaMarkerDatum): AgSeriesMarkerStyle & {
        size: number;
    };
    protected computeFocusBounds(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined;
    protected isDatumEnabled(nodeData: RangeAreaMarkerDatum[], datumIndex: number): boolean;
    protected hasItemStylers(): boolean;
}
export {};
