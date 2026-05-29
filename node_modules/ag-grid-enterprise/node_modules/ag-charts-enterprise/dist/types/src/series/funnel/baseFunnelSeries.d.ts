import { type AgFunnelSeriesStyle, _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType, RequiredInternalAgGradientColor, RequiredInternalAgImageFill, RequiredInternalAgPatternColor } from 'ag-charts-core';
import type { BaseFunnelProperties } from './baseFunnelSeriesProperties';
import { FunnelConnector } from './funnelConnector';
export type Bounds = {
    x: number;
    y: number;
    width: number;
    height: number;
};
export type FunnelNodeLabelDatum = Readonly<_ModuleSupport.Point> & {
    datumIndex: number;
    text: string;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
    datum: any;
    itemId: string;
    series: _ModuleSupport.CartesianSeriesNodeDatum['series'];
    visible: boolean;
};
export interface FunnelNodeDatum extends _ModuleSupport.CartesianSeriesNodeDatum, Readonly<_ModuleSupport.Point> {
    readonly index: number;
    readonly itemId: string;
    readonly width: number;
    readonly height: number;
    readonly label: FunnelNodeLabelDatum | undefined;
    readonly strokeWidth: number;
    readonly visible: boolean;
    readonly crisp: boolean;
    readonly opacity?: number;
    readonly clipBBox?: _ModuleSupport.BBox;
}
interface FunnelConnectorDatum {
    readonly datum: FunnelNodeDatum;
    readonly datumIndex: number;
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
    readonly x3: number;
    readonly y3: number;
    readonly opacity: number;
}
interface FunnelContext extends _ModuleSupport.AbstractBarSeriesNodeDataContext<FunnelNodeDatum, FunnelNodeLabelDatum> {
    connectorData: FunnelConnectorDatum[];
}
export interface FunnelAnimationData<TNode extends _ModuleSupport.QuadtreeCompatibleNode> extends _ModuleSupport.CartesianAnimationData<TNode, FunnelNodeDatum, FunnelNodeLabelDatum, FunnelContext> {
}
declare class FunnelSeriesNodeEvent<TEvent extends string = _ModuleSupport.SeriesNodeEventTypes> extends _ModuleSupport.SeriesNodeEvent<FunnelNodeDatum, TEvent> {
    readonly xKey?: string;
    readonly yKey?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: FunnelNodeDatum, series: BaseFunnelSeries<any, object>);
}
export interface FunnelSeriesShapeStyle {
    fill?: InternalAgColorType;
    fillGradientDefaults: RequiredInternalAgGradientColor;
    fillPatternDefaults: RequiredInternalAgPatternColor;
    fillImageDefaults: RequiredInternalAgImageFill;
    fillOpacity: number;
    stroke?: string;
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
}
export declare abstract class BaseFunnelSeries<TNode extends _ModuleSupport.QuadtreeCompatibleNode, TOpts extends object> extends _ModuleSupport.AbstractBarSeries<TNode, TOpts, BaseFunnelProperties<TOpts>, FunnelNodeDatum, FunnelNodeLabelDatum, FunnelContext> {
    protected readonly NodeEvent: typeof FunnelSeriesNodeEvent;
    protected readonly connectorNodeGroup: _ModuleSupport.Group<unknown>;
    protected connectorSelection: _ModuleSupport.Selection<FunnelConnector<any>, FunnelConnectorDatum>;
    get pickModeAxis(): "main-category";
    constructor({ moduleCtx, animationResetFns, }: {
        moduleCtx: _ModuleSupport.ModuleContext;
        animationResetFns: {
            datum: (node: TNode, datum: FunnelNodeDatum) => _ModuleSupport.AnimationValue & Partial<TNode>;
        };
    });
    setZIndex(zIndex: number): boolean;
    protected isVertical(): boolean;
    protected abstract connectorEnabled(): boolean;
    protected abstract barStyle(): FunnelSeriesShapeStyle;
    protected abstract connectorStyle(): FunnelSeriesShapeStyle;
    private connectionFactory;
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[];
    getSeriesRange(_direction: _ModuleSupport.ChartAxisDirection, _visibleRange: [any, any]): [number, number];
    createNodeData(): FunnelContext | undefined;
    protected abstract createLabelData({ datumIndex, rect, yDatum, datum, }: {
        datumIndex: number;
        rect: Bounds;
        barAlongX: boolean;
        yDatum: number;
        datum: any;
        visible: boolean;
    }): FunnelNodeLabelDatum | undefined;
    protected updateNodes(seriesHighlighted: boolean, nodeRefresh: boolean): void;
    protected updateDatumSelection(opts: {
        nodeData: FunnelNodeDatum[];
        datumSelection: _ModuleSupport.Selection<TNode, FunnelNodeDatum>;
    }): _ModuleSupport.Selection<TNode, FunnelNodeDatum>;
    private updateConnectorSelection;
    private updateConnectorNodes;
    protected getHighlightLabelData(labelData: FunnelNodeLabelDatum[], highlightedItem: FunnelNodeDatum): FunnelNodeLabelDatum[] | undefined;
    protected updateLabelSelection(opts: {
        labelData: FunnelNodeLabelDatum[];
        labelSelection: FunnelAnimationData<TNode>['labelSelection'];
    }): _ModuleSupport.Selection<_ModuleSupport.Text<any>, FunnelNodeLabelDatum>;
    protected updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, FunnelNodeLabelDatum>;
    }): void;
    protected abstract tooltipStyle(datum: any, datumIndex: number): Required<AgFunnelSeriesStyle>;
    getTooltipContent(datumIndex: number): _ModuleSupport.TooltipContent | undefined;
    protected resetAllAnimation(data: _ModuleSupport.CartesianAnimationData<TNode, FunnelNodeDatum, FunnelNodeLabelDatum, FunnelContext>): void;
    animateEmptyUpdateReady({ labelSelection }: FunnelAnimationData<TNode>): void;
    animateWaitingUpdateReady(data: FunnelAnimationData<TNode>): void;
    private getDatumId;
    protected isLabelEnabled(): boolean;
    protected computeFocusBounds({ datumIndex }: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined;
    private legendItemSymbol;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[];
    protected hasItemStylers(): boolean;
}
export {};
