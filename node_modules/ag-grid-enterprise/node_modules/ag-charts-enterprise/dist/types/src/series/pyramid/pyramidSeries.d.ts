import { type AgPyramidSeriesOptions, type AgPyramidSeriesStyle, _ModuleSupport } from 'ag-charts-community';
import { FunnelConnector } from '../funnel/funnelConnector';
import { PyramidProperties } from './pyramidProperties';
type PyramidNodeLabelDatum = Readonly<_ModuleSupport.Point> & {
    readonly text: string;
    readonly textAlign: CanvasTextAlign;
    readonly textBaseline: CanvasTextBaseline;
    readonly visible: boolean;
};
interface PyramidNodeDatum extends _ModuleSupport.DataModelSeriesNodeDatum, Readonly<_ModuleSupport.Point> {
    readonly index: number;
    readonly xValue: string;
    readonly yValue: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
    readonly label: PyramidNodeLabelDatum | undefined;
}
interface PyramidNodeDataContext extends _ModuleSupport.DataModelSeriesNodeDataContext<PyramidNodeDatum, PyramidNodeLabelDatum> {
    stageLabelData: PyramidNodeLabelDatum[] | undefined;
    bounds: _ModuleSupport.BBox;
}
export declare class PyramidSeries extends _ModuleSupport.DataModelSeries<PyramidNodeDatum, AgPyramidSeriesOptions, PyramidProperties, PyramidNodeLabelDatum, PyramidNodeDataContext> {
    static readonly className = "PyramidSeries";
    static readonly type: "pyramid";
    properties: PyramidProperties;
    private readonly itemGroup;
    private readonly itemLabelGroup;
    private readonly stageLabelGroup;
    datumSelection: _ModuleSupport.Selection<FunnelConnector, PyramidNodeDatum>;
    private labelSelection;
    private stageLabelSelection;
    private highlightDatumSelection;
    contextNodeData?: PyramidNodeDataContext;
    private readonly animationState;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    addChartEventListeners(): void;
    private nodeFactory;
    getNodeData(): PyramidNodeDatum[] | undefined;
    resetAnimation(phase: _ModuleSupport.ChartAnimationPhase): void;
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    createNodeData(): {
        itemId: string;
        nodeData: PyramidNodeDatum[];
        labelData: PyramidNodeLabelDatum[];
        stageLabelData: PyramidNodeLabelDatum[] | undefined;
        bounds: _ModuleSupport.BBox;
    } | undefined;
    updateSelections(): void;
    update({ seriesRect }: {
        seriesRect?: _ModuleSupport.BBox;
    }): void;
    private updateDatumSelection;
    protected getItemStyle({ datumIndex, datum }: Partial<PyramidNodeDatum>, isHighlight: boolean): Required<AgPyramidSeriesStyle>;
    private updateDatumNodes;
    private updateLabelSelection;
    private updateStageLabelSelection;
    private updateLabelNodes;
    protected computeFocusBounds(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | _ModuleSupport.Path | undefined;
    getTooltipContent(datumIndex: number): _ModuleSupport.TooltipContent | undefined;
    getSeriesDomain(): any[];
    getSeriesRange(_direction: _ModuleSupport.ChartAxisDirection, _visibleRange: [any, any]): [number, number];
    pickNodeClosestDatum({ x, y }: _ModuleSupport.Point): _ModuleSupport.SeriesNodePickMatch | undefined;
    private legendItemSymbol;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[];
    protected animateReset(): void;
    private animateEmptyUpdateReady;
    protected hasItemStylers(): boolean;
}
export {};
