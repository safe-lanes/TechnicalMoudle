import { type AgSankeySeriesOptions, _ModuleSupport } from 'ag-charts-community';
import { type FlowProportionNodeDatumIndex, FlowProportionSeries } from '../flow-proportion/flowProportionSeries';
import { SankeyLink } from './sankeyLink';
import { type SankeyDatum, type SankeyLinkDatum, type SankeyNodeDatum, type SankeyNodeLabelDatum, SankeySeriesProperties } from './sankeySeriesProperties';
export declare class SankeySeries extends FlowProportionSeries<SankeyNodeDatum, SankeyLinkDatum, SankeyNodeLabelDatum, AgSankeySeriesOptions, SankeySeriesProperties, _ModuleSupport.Rect, SankeyLink> {
    static readonly className = "SankeySeries";
    static readonly type: "sankey";
    properties: SankeySeriesProperties;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    private isLabelEnabled;
    protected linkFactory(): SankeyLink<any>;
    protected nodeFactory(): _ModuleSupport.Rect<any>;
    createNodeData(): {
        itemId: string;
        nodeData: SankeyDatum[];
        labelData: SankeyNodeLabelDatum[];
    } | undefined;
    protected updateLabelSelection(opts: {
        labelData: SankeyNodeLabelDatum[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.TransformableText, SankeyNodeLabelDatum>;
    }): _ModuleSupport.Selection<_ModuleSupport.TransformableText, SankeyNodeLabelDatum>;
    protected updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.TransformableText, SankeyNodeLabelDatum>;
    }): void;
    protected updateNodeSelection(opts: {
        nodeData: SankeyNodeDatum[];
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, SankeyNodeDatum>;
    }): _ModuleSupport.Selection<_ModuleSupport.Rect<any>, SankeyNodeDatum>;
    protected getNodeStyle({ datumIndex, datum, size, label }: Partial<SankeyNodeDatum>, fromNodeDatumIndex: number, isHighlight: boolean): Required<import("ag-charts-community").AgSankeySeriesLinkStyle> & Required<import("ag-charts-community").AgSankeySeriesNodeStyle> & Partial<AgSankeySeriesOptions<any, unknown> & {
        fill: import("ag-charts-community").AgColorType;
        fillOpacity: number;
        stroke: string;
        strokeWidth: number;
        strokeOpacity: number;
        lineDash: number[];
        lineDashOffset: number;
        opacity: number;
    }>;
    protected updateNodeNodes(opts: {
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, SankeyNodeDatum>;
        isHighlight: boolean;
    }): void;
    private getShapeFillBBox;
    protected updateLinkSelection(opts: {
        nodeData: SankeyLinkDatum[];
        datumSelection: _ModuleSupport.Selection<SankeyLink, SankeyLinkDatum>;
    }): _ModuleSupport.Selection<SankeyLink<any>, SankeyLinkDatum>;
    protected getLinkStyle({ datumIndex, datum }: Partial<SankeyLinkDatum>, fromNodeDatumIndex: number, isHighlight: boolean): Required<import("ag-charts-community").AgSankeySeriesLinkStyle> & Required<import("ag-charts-community").AgSankeySeriesNodeStyle> & Partial<AgSankeySeriesOptions<any, unknown> & {
        fill: import("ag-charts-community").AgColorType;
        fillOpacity: number;
        stroke: string;
        strokeWidth: number;
        strokeOpacity: number;
        lineDash: number[];
        lineDashOffset: number;
        opacity: number;
    }>;
    protected updateLinkNodes(opts: {
        datumSelection: _ModuleSupport.Selection<SankeyLink, SankeyLinkDatum>;
        isHighlight: boolean;
    }): void;
    getTooltipContent(datumIndex: FlowProportionNodeDatumIndex): _ModuleSupport.TooltipContent | undefined;
    protected computeFocusBounds(node: _ModuleSupport.Rect | SankeyLink): _ModuleSupport.BBox | _ModuleSupport.Path | undefined;
    protected hasItemStylers(): boolean;
}
