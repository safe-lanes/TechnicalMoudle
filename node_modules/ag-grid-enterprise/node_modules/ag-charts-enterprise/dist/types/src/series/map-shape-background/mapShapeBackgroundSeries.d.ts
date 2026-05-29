import { type AgMapShapeBackgroundOptions, _ModuleSupport } from 'ag-charts-community';
import { TopologySeries } from '../map-util/topologySeries';
import { type MapShapeBackgroundNodeDatum, MapShapeBackgroundSeriesProperties } from './mapShapeBackgroundSeriesProperties';
interface MapShapeBackgroundNodeDataContext extends _ModuleSupport.DataModelSeriesNodeDataContext<MapShapeBackgroundNodeDatum> {
}
export declare class MapShapeBackgroundSeries extends TopologySeries<MapShapeBackgroundNodeDatum, AgMapShapeBackgroundOptions, MapShapeBackgroundSeriesProperties, MapShapeBackgroundNodeDatum, MapShapeBackgroundNodeDataContext> implements _ModuleSupport.ITopology {
    static readonly className = "MapShapeBackgroundSeries";
    static readonly type: "map-shape-background";
    scale: _ModuleSupport.MercatorScale | undefined;
    topologyBounds: _ModuleSupport.LonLatBBox | undefined;
    properties: MapShapeBackgroundSeriesProperties;
    private _chartTopology?;
    private get topology();
    get focusable(): boolean;
    setOptionsData(): void;
    setChartData(): void;
    getNodeData(): MapShapeBackgroundNodeDatum[] | undefined;
    get hasData(): boolean;
    private readonly itemGroup;
    private datumSelection;
    private contextNodeData?;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    renderToOffscreenCanvas(): boolean;
    setChartTopology(topology: any): void;
    setZIndex(zIndex: number): boolean;
    private nodeFactory;
    processData(): void;
    createNodeData(): {
        itemId: string;
        nodeData: MapShapeBackgroundNodeDatum[];
        labelData: never[];
    } | undefined;
    updateSelections(): void;
    update(): void;
    private updateDatumSelection;
    private updateDatumNodes;
    resetAnimation(): void;
    getLegendData(): never[];
    getTooltipContent(_seriesDatum: any): _ModuleSupport.TooltipContent | undefined;
    pickFocus(): undefined;
    protected computeFocusBounds(_opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined;
    protected hasItemStylers(): boolean;
}
export {};
