import { type AgMapLineBackgroundOptions, _ModuleSupport } from 'ag-charts-community';
import { TopologySeries } from '../map-util/topologySeries';
import { type MapLineBackgroundNodeDatum, MapLineBackgroundSeriesProperties } from './mapLineBackgroundSeriesProperties';
interface MapLineNodeDataContext extends _ModuleSupport.DataModelSeriesNodeDataContext<MapLineBackgroundNodeDatum> {
}
export declare class MapLineBackgroundSeries extends TopologySeries<MapLineBackgroundNodeDatum, AgMapLineBackgroundOptions, MapLineBackgroundSeriesProperties, MapLineBackgroundNodeDatum, MapLineNodeDataContext> implements _ModuleSupport.ITopology {
    static readonly className = "MapLineBackgroundSeries";
    static readonly type: "map-line-background";
    scale: _ModuleSupport.MercatorScale | undefined;
    topologyBounds: _ModuleSupport.LonLatBBox | undefined;
    properties: MapLineBackgroundSeriesProperties;
    private _chartTopology?;
    getNodeData(): MapLineBackgroundNodeDatum[] | undefined;
    private get topology();
    get focusable(): boolean;
    setOptionsData(): void;
    setChartData(): void;
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
        nodeData: MapLineBackgroundNodeDatum[];
        labelData: never[];
    } | undefined;
    updateSelections(): void;
    update(): void;
    private updateDatumSelection;
    private updateDatumNodes;
    resetAnimation(): void;
    getLegendData(): never[];
    getTooltipContent(_seriesDatum: any): _ModuleSupport.TooltipContent | undefined;
    protected computeFocusBounds(_opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined;
    protected hasItemStylers(): boolean;
}
export {};
