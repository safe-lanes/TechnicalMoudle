import type { AgWaterfallSeriesItemType, AgWaterfallSeriesOptions } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import { WaterfallSeriesProperties } from './waterfallSeriesProperties';
type WaterfallNodeLabelDatum = Readonly<_ModuleSupport.Point> & {
    readonly text: string;
    readonly textAlign: CanvasTextAlign;
    readonly textBaseline: CanvasTextBaseline;
};
type WaterfallNodePointDatum = _ModuleSupport.DataModelSeriesNodeDatum['point'] & {
    readonly x2: number;
    readonly y2: number;
};
interface WaterfallNodeDatum extends _ModuleSupport.CartesianSeriesNodeDatum, Readonly<_ModuleSupport.Point> {
    readonly index: number;
    readonly itemId: AgWaterfallSeriesItemType;
    readonly cumulativeValue: number;
    readonly width: number;
    readonly height: number;
    readonly label: WaterfallNodeLabelDatum;
    readonly crisp: boolean;
    readonly clipBBox?: _ModuleSupport.BBox;
    readonly opacity?: number;
}
interface WaterfallContext extends _ModuleSupport.AbstractBarSeriesNodeDataContext<WaterfallNodeDatum> {
    pointData?: WaterfallNodePointDatum[];
}
type WaterfallAnimationData = _ModuleSupport.CartesianAnimationData<_ModuleSupport.Rect, WaterfallNodeDatum, WaterfallNodeDatum, WaterfallContext>;
export declare class WaterfallSeries extends _ModuleSupport.AbstractBarSeries<_ModuleSupport.Rect<WaterfallNodeDatum>, AgWaterfallSeriesOptions, WaterfallSeriesProperties, WaterfallNodeDatum, WaterfallNodeDatum, WaterfallContext> {
    static readonly className = "WaterfallSeries";
    static readonly type: "waterfall";
    properties: WaterfallSeriesProperties;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    private readonly seriesItemTypes;
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[];
    getSeriesRange(_direction: _ModuleSupport.ChartAxisDirection, _visibleRange: [any, any]): [number, number];
    createNodeData(): WaterfallContext | undefined;
    private updateSeriesItemTypes;
    private isSubtotal;
    private isTotal;
    protected nodeFactory(): _ModuleSupport.Rect<any>;
    private getSeriesItemType;
    private getItemConfig;
    protected updateDatumSelection(opts: {
        nodeData: WaterfallNodeDatum[];
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, WaterfallNodeDatum>;
    }): _ModuleSupport.Selection<_ModuleSupport.Rect<any>, WaterfallNodeDatum>;
    private getItemStyle;
    protected updateDatumNodes(opts: {
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, WaterfallNodeDatum>;
        isHighlight: boolean;
    }): void;
    protected updateLabelSelection(opts: {
        labelData: WaterfallNodeDatum[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, WaterfallNodeDatum>;
    }): _ModuleSupport.Selection<_ModuleSupport.Text<any>, WaterfallNodeDatum>;
    protected updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, WaterfallNodeDatum>;
    }): void;
    getTooltipContent(datumIndex: number): _ModuleSupport.TooltipContent | undefined;
    private legendItemSymbol;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[];
    protected toggleSeriesItem(): void;
    animateEmptyUpdateReady(opts: WaterfallAnimationData): void;
    protected animateConnectorLinesHorizontal(opts: WaterfallAnimationData): void;
    protected animateConnectorLinesVertical(opts: WaterfallAnimationData): void;
    animateReadyResize(data: WaterfallAnimationData): void;
    protected updatePaths(opts: {
        seriesHighlighted?: boolean;
        itemId?: string;
        contextData: WaterfallContext;
        paths: _ModuleSupport.Path[];
        seriesIdx: number;
    }): void;
    resetConnectorLinesPath({ contextData, paths, }: {
        contextData: WaterfallContext;
        paths: Array<_ModuleSupport.Path>;
    }): void;
    protected updateLineNode(lineNode: _ModuleSupport.Path): void;
    protected isLabelEnabled(): boolean;
    protected onDataChange(): void;
    protected computeFocusBounds({ datumIndex }: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined;
    protected hasItemStylers(): boolean;
}
export {};
