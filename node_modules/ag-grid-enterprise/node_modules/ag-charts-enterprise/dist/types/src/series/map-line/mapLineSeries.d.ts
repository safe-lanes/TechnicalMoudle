import { type AgMapLineSeriesStyle, _ModuleSupport } from 'ag-charts-community';
import type { AgMapLineSeriesOptions } from 'ag-charts-types';
import { GeoGeometry } from '../map-util/geoGeometry';
import { TopologySeries } from '../map-util/topologySeries';
import { type MapLineNodeDatum, type MapLineNodeLabelDatum, MapLineSeriesProperties } from './mapLineSeriesProperties';
interface MapLineNodeDataContext extends _ModuleSupport.DataModelSeriesNodeDataContext<MapLineNodeDatum, MapLineNodeLabelDatum> {
}
type ItemStyle = Required<AgMapLineSeriesStyle> & {
    opacity: number;
};
export declare class MapLineSeries extends TopologySeries<MapLineNodeDatum, AgMapLineSeriesOptions, MapLineSeriesProperties, MapLineNodeLabelDatum, MapLineNodeDataContext> {
    static readonly className = "MapLineSeries";
    static readonly type: "map-line";
    scale: _ModuleSupport.MercatorScale | undefined;
    topologyBounds: _ModuleSupport.LonLatBBox | undefined;
    properties: MapLineSeriesProperties;
    private _chartTopology?;
    getNodeData(): MapLineNodeDatum[] | undefined;
    private get topology();
    get hasData(): boolean;
    private readonly colorScale;
    private readonly sizeScale;
    datumSelection: _ModuleSupport.Selection<GeoGeometry, MapLineNodeDatum>;
    private labelSelection;
    private highlightDatumSelection;
    contextNodeData?: MapLineNodeDataContext;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    renderToOffscreenCanvas(): boolean;
    setZIndex(zIndex: number): boolean;
    setChartTopology(topology: any): void;
    private isLabelEnabled;
    private nodeFactory;
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    private isColorScaleValid;
    private getLabelDatum;
    createNodeData(): {
        itemId: string;
        nodeData: MapLineNodeDatum[];
        labelData: MapLineNodeLabelDatum[];
    } | undefined;
    updateSelections(): void;
    update(): void;
    private updateDatumSelection;
    private getItemBaseStyle;
    protected getItemStyleOverrides(datumId: string, datum: any, colorValue: number | undefined, sizeValue: number | undefined, format: ItemStyle, highlighted: boolean, datumIndex?: number): Partial<ItemStyle> | undefined;
    private updateDatumNodes;
    updatePlacedLabelData(labelData: _ModuleSupport.PlacedLabel<MapLineNodeLabelDatum>[]): void;
    private updateLabelNodes;
    resetAnimation(): void;
    getLabelData(): MapLineNodeLabelDatum[];
    pickNodeClosestDatum({ x, y }: _ModuleSupport.Point): _ModuleSupport.SeriesNodePickMatch | undefined;
    private _previousDatumMidPoint;
    datumMidPoint(datum: _ModuleSupport.SeriesNodeDatum<unknown>): _ModuleSupport.Point | undefined;
    private legendItemSymbol;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[] | _ModuleSupport.GradientLegendDatum[];
    getTooltipContent(datumIndex: number): _ModuleSupport.TooltipContent | undefined;
    protected computeFocusBounds(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined;
    protected hasItemStylers(): boolean;
}
export {};
