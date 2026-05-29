import { type AgMapMarkerSeriesStyle, _ModuleSupport } from 'ag-charts-community';
import { type AgMapMarkerSeriesOptions } from 'ag-charts-types';
import { TopologySeries } from '../map-util/topologySeries';
import { type MapMarkerNodeDatum, type MapMarkerNodeLabelDatum, MapMarkerSeriesProperties } from './mapMarkerSeriesProperties';
interface MapMarkerNodeDataContext extends _ModuleSupport.DataModelSeriesNodeDataContext<MapMarkerNodeDatum, MapMarkerNodeLabelDatum> {
}
export declare class MapMarkerSeries extends TopologySeries<MapMarkerNodeDatum, AgMapMarkerSeriesOptions, MapMarkerSeriesProperties, MapMarkerNodeLabelDatum, MapMarkerNodeDataContext> implements _ModuleSupport.ITopology {
    static readonly className = "MapMarkerSeries";
    static readonly type: "map-marker";
    scale: _ModuleSupport.MercatorScale | undefined;
    topologyBounds: _ModuleSupport.LonLatBBox | undefined;
    properties: MapMarkerSeriesProperties;
    private _chartTopology?;
    getNodeData(): MapMarkerNodeDatum[] | undefined;
    private get topology();
    get hasData(): boolean;
    private readonly colorScale;
    private readonly sizeScale;
    private readonly markerGroup;
    private labelSelection;
    private markerSelection;
    private highlightMarkerSelection;
    private contextNodeData?;
    private readonly animationState;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    renderToOffscreenCanvas(): boolean;
    setChartTopology(topology: any): void;
    setZIndex(zIndex: number): boolean;
    private isLabelEnabled;
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    private isColorScaleValid;
    private getLabelDatum;
    createNodeData(): {
        itemId: string;
        nodeData: MapMarkerNodeDatum[];
        labelData: MapMarkerNodeLabelDatum[];
    } | undefined;
    updateSelections(): void;
    private previousScale;
    private checkScaleChange;
    update({ seriesRect }: {
        seriesRect?: _ModuleSupport.BBox;
    }): void;
    updatePlacedLabelData(labelData: _ModuleSupport.PlacedLabel<MapMarkerNodeLabelDatum>[]): void;
    private updateLabelNodes;
    private updateMarkerSelection;
    protected getMarkerItemStyle({ datumIndex, datum, colorValue, sizeValue }: Partial<MapMarkerNodeDatum>, isHighlight: boolean): Required<AgMapMarkerSeriesStyle>;
    private updateMarkerNodes;
    isProcessedDataAnimatable(): boolean;
    resetAnimation(phase: _ModuleSupport.ChartAnimationPhase): void;
    private resetAllAnimation;
    private animateMarkers;
    getLabelData(): MapMarkerNodeLabelDatum[];
    pickNodeClosestDatum(p: _ModuleSupport.Point): _ModuleSupport.SeriesNodePickMatch | undefined;
    private legendItemSymbol;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[] | _ModuleSupport.GradientLegendDatum[];
    getTooltipContent(datumIndex: number): _ModuleSupport.TooltipContent | undefined;
    getFormattedMarkerStyle(markerDatum: MapMarkerNodeDatum): {
        size: number;
        shape: import("ag-charts-community").AgMarkerShape;
    };
    protected computeFocusBounds(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined;
    protected hasItemStylers(): boolean;
}
export {};
