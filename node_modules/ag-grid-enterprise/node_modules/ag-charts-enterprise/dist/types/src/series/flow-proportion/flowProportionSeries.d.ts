import { _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
import type { FlowProportionSeriesProperties } from './flowProportionProperties';
declare const Series: typeof _ModuleSupport.Series;
export declare enum FlowProportionDatumType {
    Link = 0,
    Node = 1
}
export type FlowProportionNodeDatumIndex = {
    type: FlowProportionDatumType;
    index: number;
};
export interface FlowProportionLinkDatum<TNodeDatum extends FlowProportionNodeDatum<TNodeDatum, TLinkDatum>, TLinkDatum extends FlowProportionLinkDatum<TNodeDatum, TLinkDatum>> extends _ModuleSupport.SeriesNodeDatum<FlowProportionNodeDatumIndex> {
    type: FlowProportionDatumType.Link;
    index: number;
    fromNode: TNodeDatum;
    toNode: TNodeDatum;
    size: number;
}
export interface FlowProportionNodeDatum<TNodeDatum extends FlowProportionNodeDatum<TNodeDatum, TLinkDatum>, TLinkDatum extends FlowProportionLinkDatum<TNodeDatum, TLinkDatum>> extends _ModuleSupport.SeriesNodeDatum<FlowProportionNodeDatumIndex> {
    type: FlowProportionDatumType.Node;
    index: number;
    linksBefore: TLinkDatum[];
    linksAfter: TLinkDatum[];
    id: string;
    size: number;
    label: string | undefined;
}
export interface FlowProportionSeriesContext<TNodeDatum extends FlowProportionNodeDatum<TNodeDatum, TLinkDatum>, TLinkDatum extends FlowProportionLinkDatum<TNodeDatum, TLinkDatum>, TLabel> extends _ModuleSupport.SeriesNodeDataContext<FlowProportionNodeDatumIndex, TDatum<TNodeDatum, TLinkDatum>, TLabel> {
}
type TDatum<TNodeDatum extends FlowProportionNodeDatum<TNodeDatum, TLinkDatum>, TLinkDatum extends FlowProportionLinkDatum<TNodeDatum, TLinkDatum>> = TLinkDatum | TNodeDatum;
export declare class FlowProportionSeriesNodeEvent<TEvent extends string = _ModuleSupport.SeriesNodeEventTypes> extends _ModuleSupport.SeriesNodeEvent<_ModuleSupport.SeriesNodeDatum<FlowProportionNodeDatumIndex>, TEvent> {
    readonly size?: number;
    readonly label?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: _ModuleSupport.SeriesNodeDatum<FlowProportionNodeDatumIndex>, series: _ModuleSupport.ISeries<FlowProportionNodeDatumIndex, _ModuleSupport.SeriesNodeDatum<FlowProportionNodeDatumIndex>, unknown> & {
        contextNodeData?: _ModuleSupport.SeriesNodeDataContext<FlowProportionNodeDatumIndex, TDatum<FlowProportionNodeDatum<any, any>, FlowProportionLinkDatum<any, any>>, unknown>;
    });
}
export declare abstract class FlowProportionSeries<TNodeDatum extends FlowProportionNodeDatum<TNodeDatum, TLinkDatum>, TLinkDatum extends FlowProportionLinkDatum<TNodeDatum, TLinkDatum>, TLabel, TOpts extends object, TProps extends FlowProportionSeriesProperties<TOpts>, TNode extends _ModuleSupport.Node & _ModuleSupport.DistantObject, TLink extends _ModuleSupport.Node & _ModuleSupport.DistantObject> extends Series<FlowProportionNodeDatumIndex, TDatum<TNodeDatum, TLinkDatum>, TOpts, TProps, TLabel, _ModuleSupport.SeriesNodeDataContext<FlowProportionNodeDatumIndex, TDatum<TNodeDatum, TLinkDatum>, TLabel>> {
    protected readonly NodeEvent: typeof FlowProportionSeriesNodeEvent;
    abstract properties: TProps;
    protected get nodes(): any[] | undefined;
    protected nodeCount: number;
    protected linkCount: number;
    protected linksDataModel: _ModuleSupport.DataModel<any, any, false> | undefined;
    protected linksProcessedData: _ModuleSupport.ProcessedData<any> | undefined;
    protected nodesDataModel: _ModuleSupport.DataModel<any, any, true> | undefined;
    protected nodesProcessedData: _ModuleSupport.ProcessedData<any> | undefined;
    contextNodeData?: _ModuleSupport.SeriesNodeDataContext<FlowProportionNodeDatumIndex, TDatum<TNodeDatum, TLinkDatum>, TLabel>;
    private processedNodes;
    private readonly linkGroup;
    private readonly nodeGroup;
    private readonly focusLinkGroup;
    private readonly focusNodeGroup;
    private readonly highlightLinkGroup;
    private readonly highlightNodeGroup;
    private labelSelection;
    linkSelection: _ModuleSupport.Selection<TLink, TLinkDatum>;
    nodeSelection: _ModuleSupport.Selection<TNode, TNodeDatum>;
    private focusLinkSelection;
    private focusNodeSelection;
    private highlightLinkSelection;
    private highlightNodeSelection;
    protected abstract linkFactory(): TLink;
    protected abstract nodeFactory(): TNode;
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    protected getNodeGraph(createNode: (node: FlowProportionNodeDatum<TNodeDatum, TLinkDatum>) => TNodeDatum, createLink: (link: FlowProportionLinkDatum<TNodeDatum, TLinkDatum>) => TLinkDatum, { includeCircularReferences }: {
        includeCircularReferences: boolean;
    }): {
        nodeGraph: Map<string, import("./flowProportionUtil").NodeGraphEntry<TNodeDatum, TLinkDatum>>;
        links: TLinkDatum[];
        maxPathLength: number;
    };
    updateSelections(): void;
    update(opts: {
        seriesRect?: _ModuleSupport.BBox;
    }): void;
    protected abstract updateLabelSelection(opts: {
        labelData: TLabel[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.TransformableText, TLabel>;
    }): _ModuleSupport.Selection<_ModuleSupport.TransformableText, TLabel>;
    protected abstract updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, TLabel>;
    }): void;
    protected abstract updateNodeSelection(opts: {
        nodeData: TNodeDatum[];
        datumSelection: _ModuleSupport.Selection<TNode, TNodeDatum>;
    }): _ModuleSupport.Selection<TNode, TNodeDatum>;
    protected abstract updateNodeNodes(opts: {
        datumSelection: _ModuleSupport.Selection<TNode, TNodeDatum>;
        isHighlight: boolean;
    }): void;
    protected abstract updateLinkSelection(opts: {
        nodeData: TLinkDatum[];
        datumSelection: _ModuleSupport.Selection<TLink, TLinkDatum>;
    }): _ModuleSupport.Selection<TLink, TLinkDatum>;
    protected abstract updateLinkNodes(opts: {
        datumSelection: _ModuleSupport.Selection<TLink, TLinkDatum>;
        isHighlight: boolean;
    }): void;
    resetAnimation(_chartAnimationPhase: _ModuleSupport.ChartAnimationPhase): void;
    dataCount(): number;
    getSeriesDomain(_direction: _ModuleSupport.ChartAxisDirection): any[];
    getSeriesRange(_direction: _ModuleSupport.ChartAxisDirection, _visibleRange: [any, any]): [number, number];
    protected legendItemSymbol(_type: FlowProportionDatumType, nodeIndex: number, format?: {
        fill?: InternalAgColorType;
        fillOpacity?: number;
        stroke?: string;
        strokeWidth?: number;
        strokeOpacity?: number;
        lineDash?: number[];
        lineDashOffset?: number;
    }): _ModuleSupport.LegendSymbolOptions;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[];
    pickNodeClosestDatum({ x, y }: _ModuleSupport.Point): _ModuleSupport.SeriesNodePickMatch | undefined;
    getDatumAriaText(datum: TDatum<TNodeDatum, TLinkDatum>, description: string): string | undefined;
    protected abstract computeFocusBounds(node: TNode | TLink): _ModuleSupport.BBox | _ModuleSupport.Path | undefined;
    pickFocus(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.PickFocusOutputs | undefined;
    getCategoryValue(_datumIndex: FlowProportionNodeDatumIndex): any;
    datumIndexForCategoryValue(_categoryValue: any): FlowProportionNodeDatumIndex | undefined;
}
export {};
