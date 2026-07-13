import { type AgTreemapSeriesOptions, type FontStyle, type FontWeight, type TextAlign, type VerticalAlign, _ModuleSupport } from 'ag-charts-community';
import { TreemapSeriesProperties } from './treemapSeriesProperties';
declare class TreemapNode extends _ModuleSupport.HierarchyNode<TreemapNode> {
    labelValue: string | undefined;
    secondaryLabelValue: string | undefined;
    label: LabelLayout | undefined;
    secondaryLabel: LabelLayout | undefined;
    bbox: _ModuleSupport.BBox | undefined;
    padding: Padding | undefined;
}
interface Padding {
    top: number;
    right: number;
    bottom: number;
    left: number;
}
interface LabelLayout {
    text: string;
    fontSize: number;
    lineHeight: number;
    fontStyle: FontStyle;
    fontFamily: string;
    fontWeight: FontWeight;
    color: string;
    textAlign: TextAlign;
    verticalAlign: VerticalAlign;
    x: number;
    y: number;
}
declare class DistantGroup extends _ModuleSupport.Group implements _ModuleSupport.DistantObject {
    distanceSquared(x: number, y: number): number;
}
export declare class TreemapSeries extends _ModuleSupport.HierarchySeries<DistantGroup, AgTreemapSeriesOptions, TreemapSeriesProperties, TreemapNode> {
    static readonly className = "TreemapSeries";
    static readonly type: "treemap";
    NodeClass: typeof TreemapNode;
    properties: TreemapSeriesProperties;
    private readonly rectGroup;
    protected readonly datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect<any>, TreemapNode>;
    private readonly labelSelection;
    private readonly highlightSelection;
    private groupTitleHeight;
    private getNodePadding;
    private sortChildren;
    /**
     * Squarified Treemap algorithm
     * https://www.win.tue.nl/~vanwijk/stm.pdf
     */
    private squarify;
    private applyGap;
    createNodeData(): undefined;
    private getItemStyle;
    updateSelections(): void;
    updateNodes(): void;
    pickNodesExactShape(point: _ModuleSupport.Point): TreemapNode[];
    protected pickNodeClosestDatum(point: _ModuleSupport.Point): _ModuleSupport.SeriesNodePickMatch | undefined;
    getTooltipContent(datumIndex: number[]): _ModuleSupport.TooltipContent | undefined;
    protected computeFocusBounds(node: _ModuleSupport.Group): _ModuleSupport.BBox | undefined;
    protected hasItemStylers(): boolean;
}
export {};
