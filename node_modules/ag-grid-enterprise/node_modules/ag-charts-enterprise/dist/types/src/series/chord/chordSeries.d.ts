import { _ModuleSupport } from 'ag-charts-community';
import type { AgChordSeriesOptions } from 'ag-charts-types';
import { type FlowProportionLinkDatum, type FlowProportionNodeDatum, type FlowProportionNodeDatumIndex, FlowProportionSeries, type FlowProportionSeriesContext } from '../flow-proportion/flowProportionSeries';
import { ChordLink } from './chordLink';
import { ChordSeriesProperties } from './chordSeriesProperties';
interface ChordNodeDatum extends FlowProportionNodeDatum<ChordNodeDatum, ChordLinkDatum> {
    centerX: number;
    centerY: number;
    innerRadius: number;
    outerRadius: number;
    startAngle: number;
    endAngle: number;
}
interface ChordLinkDatum extends FlowProportionLinkDatum<ChordNodeDatum, ChordLinkDatum> {
    centerX: number;
    centerY: number;
    radius: number;
    startAngle1: number;
    endAngle1: number;
    startAngle2: number;
    endAngle2: number;
}
interface ChordNodeLabelDatum {
    id: string;
    text: string;
    centerX: number;
    centerY: number;
    angle: number;
    radius: number;
    size: number;
}
interface ChordNodeDataContext extends FlowProportionSeriesContext<ChordNodeDatum, ChordLinkDatum, ChordNodeLabelDatum> {
}
export declare class ChordSeries extends FlowProportionSeries<ChordNodeDatum, ChordLinkDatum, ChordNodeLabelDatum, AgChordSeriesOptions, ChordSeriesProperties, _ModuleSupport.Sector, ChordLink> {
    static readonly className = "ChordSeries";
    static readonly type: "chord";
    properties: ChordSeriesProperties;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    private isLabelEnabled;
    protected linkFactory(): ChordLink<any>;
    protected nodeFactory(): _ModuleSupport.Sector<any>;
    createNodeData(): ChordNodeDataContext | undefined;
    protected updateLabelSelection(opts: {
        labelData: ChordNodeLabelDatum[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.TransformableText, ChordNodeLabelDatum>;
    }): _ModuleSupport.Selection<_ModuleSupport.TransformableText, ChordNodeLabelDatum>;
    protected updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.TransformableText, ChordNodeLabelDatum>;
    }): void;
    protected updateNodeSelection(opts: {
        nodeData: ChordNodeDatum[];
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Sector, ChordNodeDatum>;
    }): _ModuleSupport.Selection<_ModuleSupport.Sector<any>, ChordNodeDatum>;
    protected getNodeStyle({ datumIndex, datum, size, label }: Partial<ChordNodeDatum>, fromNodeDatumIndex: number, isHighlight: boolean): Required<import("ag-charts-community").AgChordSeriesNodeStyle> & Partial<AgChordSeriesOptions<any, unknown> & {
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
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Sector, ChordNodeDatum>;
        isHighlight: boolean;
    }): void;
    protected updateLinkSelection(opts: {
        nodeData: ChordLinkDatum[];
        datumSelection: _ModuleSupport.Selection<ChordLink, ChordLinkDatum>;
    }): _ModuleSupport.Selection<ChordLink<any>, ChordLinkDatum>;
    protected getLinkStyle({ datumIndex, datum }: Partial<ChordLinkDatum>, fromNodeDatumIndex: FlowProportionNodeDatumIndex, isHighlight: boolean): Partial<AgChordSeriesOptions<any, unknown> & {
        fill: import("ag-charts-community").AgColorType;
        fillOpacity: number;
        stroke: string;
        strokeWidth: number;
        strokeOpacity: number;
        lineDash: number[];
        lineDashOffset: number;
        opacity: number;
    }> & Required<import("ag-charts-community").AgChordSeriesLinkStyle>;
    protected updateLinkNodes(opts: {
        datumSelection: _ModuleSupport.Selection<ChordLink, ChordLinkDatum>;
        isHighlight: boolean;
    }): void;
    private getShapeFillBBox;
    getTooltipContent(datumIndex: FlowProportionNodeDatumIndex): _ModuleSupport.TooltipContent | undefined;
    protected computeFocusBounds(node: _ModuleSupport.Sector | ChordLink): _ModuleSupport.BBox | _ModuleSupport.Path | undefined;
    protected hasItemStylers(): boolean;
}
export {};
