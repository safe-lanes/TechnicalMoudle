import { type AgRangeBarSeriesOptions, _ModuleSupport } from 'ag-charts-community';
import { RangeBarProperties } from './rangeBarProperties';
interface RangeBarNodeLabelDatum extends Readonly<_ModuleSupport.Point> {
    datumIndex: number;
    text: string;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
    datum: any;
    itemId: string;
    series: _ModuleSupport.CartesianSeriesNodeDatum['series'];
}
interface RangeBarNodeDatum extends Omit<_ModuleSupport.CartesianSeriesNodeDatum, 'yKey' | 'yValue'>, Readonly<_ModuleSupport.Point> {
    readonly index: number;
    readonly itemId: string;
    readonly yLowKey: string;
    readonly yHighKey: string;
    readonly yLowValue: number;
    readonly yHighValue: number;
    readonly width: number;
    readonly height: number;
    readonly labels: RangeBarNodeLabelDatum[];
    readonly crisp: boolean;
    readonly clipBBox?: _ModuleSupport.BBox;
    readonly opacity?: number;
}
type RangeBarContext = _ModuleSupport.AbstractBarSeriesNodeDataContext<RangeBarNodeDatum, RangeBarNodeLabelDatum>;
type RangeBarAnimationData = _ModuleSupport.AbstractBarSeriesAnimationData<_ModuleSupport.Rect, RangeBarNodeDatum, RangeBarNodeLabelDatum>;
declare class RangeBarSeriesNodeEvent<TEvent extends string = _ModuleSupport.SeriesNodeEventTypes> extends _ModuleSupport.SeriesNodeEvent<RangeBarNodeDatum, TEvent> {
    readonly xKey?: string;
    readonly yLowKey?: string;
    readonly yHighKey?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: RangeBarNodeDatum, series: RangeBarSeries);
}
export declare class RangeBarSeries extends _ModuleSupport.AbstractBarSeries<_ModuleSupport.Rect<RangeBarNodeDatum>, AgRangeBarSeriesOptions, RangeBarProperties, RangeBarNodeDatum, RangeBarNodeLabelDatum> {
    static readonly className = "RangeBarSeries";
    static readonly type: "range-bar";
    properties: RangeBarProperties;
    private dataAggregationFilters;
    protected readonly NodeEvent: typeof RangeBarSeriesNodeEvent;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    private aggregateData;
    getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[];
    getSeriesRange(_direction: _ModuleSupport.ChartAxisDirection, visibleRange: [any, any]): any[];
    createNodeData(): RangeBarContext | undefined;
    private createLabelData;
    protected nodeFactory(): _ModuleSupport.Rect<any>;
    protected updateDatumSelection(opts: {
        nodeData: RangeBarNodeDatum[];
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, RangeBarNodeDatum>;
    }): _ModuleSupport.Selection<_ModuleSupport.Rect<any>, RangeBarNodeDatum>;
    private getItemStyle;
    protected updateDatumNodes(opts: {
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, RangeBarNodeDatum>;
        isHighlight: boolean;
    }): void;
    protected getHighlightLabelData(labelData: RangeBarNodeLabelDatum[], highlightedItem: RangeBarNodeDatum): RangeBarNodeLabelDatum[] | undefined;
    protected updateLabelSelection(opts: {
        labelData: RangeBarNodeLabelDatum[];
        labelSelection: RangeBarAnimationData['labelSelection'];
    }): _ModuleSupport.Selection<_ModuleSupport.Text<any>, RangeBarNodeLabelDatum>;
    protected updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, RangeBarNodeLabelDatum>;
    }): void;
    getTooltipContent(datumIndex: number): _ModuleSupport.TooltipContent | undefined;
    private legendItemSymbol;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[];
    animateEmptyUpdateReady({ datumSelection, labelSelection }: RangeBarAnimationData): void;
    animateWaitingUpdateReady(data: RangeBarAnimationData): void;
    private getDatumId;
    protected isLabelEnabled(): boolean;
    protected onDataChange(): void;
    protected computeFocusBounds({ datumIndex }: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined;
    protected hasItemStylers(): boolean;
}
export {};
