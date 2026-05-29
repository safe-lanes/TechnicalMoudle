import { _ModuleSupport } from 'ag-charts-community';
import type { AgMapShapeSeriesOptions, AgMapShapeSeriesStyle } from 'ag-charts-types';
import { GeoGeometry } from '../map-util/geoGeometry';
import { TopologySeries } from '../map-util/topologySeries';
import { type MapShapeNodeDatum, type MapShapeNodeLabelDatum, MapShapeSeriesProperties } from './mapShapeSeriesProperties';
interface MapShapeNodeDataContext extends _ModuleSupport.DataModelSeriesNodeDataContext<MapShapeNodeDatum, MapShapeNodeLabelDatum> {
}
export declare class MapShapeSeries extends TopologySeries<MapShapeNodeDatum, AgMapShapeSeriesOptions, MapShapeSeriesProperties, MapShapeNodeLabelDatum, MapShapeNodeDataContext> implements _ModuleSupport.ITopology {
    static readonly className = "MapShapeSeries";
    static readonly type: "map-shape";
    scale: _ModuleSupport.MercatorScale | undefined;
    topologyBounds: _ModuleSupport.LonLatBBox | undefined;
    properties: MapShapeSeriesProperties;
    private _chartTopology?;
    getNodeData(): MapShapeNodeDatum[] | undefined;
    private get topology();
    get hasData(): boolean;
    private readonly colorScale;
    private readonly itemGroup;
    private readonly itemLabelGroup;
    datumSelection: _ModuleSupport.Selection<GeoGeometry, MapShapeNodeDatum>;
    private labelSelection;
    private highlightDatumSelection;
    contextNodeData?: MapShapeNodeDataContext;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    renderToOffscreenCanvas(): boolean;
    setChartTopology(topology: any): void;
    setZIndex(zIndex: number): boolean;
    private isLabelEnabled;
    private nodeFactory;
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    private isColorScaleValid;
    private getLabelLayout;
    private getLabelDatum;
    private previousLabelLayouts;
    createNodeData(): {
        itemId: string;
        nodeData: MapShapeNodeDatum[];
        labelData: MapShapeNodeLabelDatum[];
    } | undefined;
    updateSelections(): void;
    update(): void;
    private updateDatumSelection;
    protected getItemStyle({ datumIndex, datum, colorValue }: Partial<MapShapeNodeDatum>, isHighlight: boolean): Required<AgMapShapeSeriesStyle>;
    private updateDatumNodes;
    private updateLabelSelection;
    private updateLabelNodes;
    resetAnimation(): void;
    pickNodeClosestDatum({ x, y }: _ModuleSupport.Point): _ModuleSupport.SeriesNodePickMatch | undefined;
    private _previousDatumMidPoint;
    datumMidPoint(datum: _ModuleSupport.SeriesNodeDatum<unknown>): _ModuleSupport.Point | undefined;
    private legendItemSymbol;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[] | _ModuleSupport.GradientLegendDatum[];
    getTooltipContent(datumIndex: number): _ModuleSupport.TooltipContent | undefined;
    protected computeFocusBounds(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.Path | undefined;
    protected hasItemStylers(): boolean;
}
export {};
