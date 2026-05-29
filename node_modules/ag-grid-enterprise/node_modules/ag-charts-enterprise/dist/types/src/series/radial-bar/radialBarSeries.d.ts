import { type AgRadialBarSeriesOptions, type AgRadialSeriesStyle, _ModuleSupport } from 'ag-charts-community';
import { type RequiredInternalAgGradientColor } from 'ag-charts-core';
import { RadialBarSeriesProperties } from './radialBarSeriesProperties';
declare class RadialBarSeriesNodeEvent<TEvent extends string = _ModuleSupport.SeriesNodeEventTypes> extends _ModuleSupport.SeriesNodeEvent<RadialBarNodeDatum, TEvent> {
    readonly angleKey?: string;
    readonly radiusKey?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: RadialBarNodeDatum, series: RadialBarSeries);
}
interface RadialBarLabelNodeDatum {
    text: string;
    x: number;
    y: number;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
}
interface RadialBarNodeDatum extends _ModuleSupport.DataModelSeriesNodeDatum {
    readonly label?: RadialBarLabelNodeDatum;
    readonly angleValue: any;
    readonly radiusValue: any;
    readonly innerRadius: number;
    readonly outerRadius: number;
    readonly startAngle: number;
    readonly endAngle: number;
    readonly clipSector: _ModuleSupport.SectorBox;
    readonly reversed: boolean;
    readonly index: number;
}
export declare class RadialBarSeries extends _ModuleSupport.PolarSeries<RadialBarNodeDatum, AgRadialBarSeriesOptions, RadialBarSeriesProperties<AgRadialBarSeriesOptions>, _ModuleSupport.Sector> {
    static readonly className = "RadialBarSeries";
    static readonly type: "radial-bar";
    properties: RadialBarSeriesProperties<AgRadialBarSeriesOptions<any, unknown>>;
    protected readonly NodeEvent: typeof RadialBarSeriesNodeEvent;
    private readonly groupScale;
    protected get defaultShapeStyle(): RequiredInternalAgGradientColor;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    protected nodeFactory(): _ModuleSupport.Sector;
    getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[];
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    protected circleCache: {
        r: number;
        cx: number;
        cy: number;
    };
    protected didCircleChange(): boolean;
    protected maybeRefreshNodeData(): void;
    protected getAxisInnerRadius(): number;
    createNodeData(): {
        itemId: string;
        nodeData: RadialBarNodeDatum[];
        labelData: RadialBarNodeDatum[];
    } | undefined;
    update({ seriesRect }: {
        seriesRect?: _ModuleSupport.BBox;
    }): void;
    protected getItemStyle(nodeDatum: RadialBarNodeDatum, isHighlight: boolean): Required<AgRadialSeriesStyle>;
    protected updateSectorSelection(selection: _ModuleSupport.Selection<_ModuleSupport.Sector, RadialBarNodeDatum>, isHighlight: boolean): void;
    protected updateLabels(): void;
    private getBarTransitionFunctions;
    protected animateEmptyUpdateReady(): void;
    animateClearingUpdateEmpty(): void;
    getTooltipContent(datumIndex: number): _ModuleSupport.TooltipContent | undefined;
    protected pickNodeClosestDatum(point: _ModuleSupport.Point): _ModuleSupport.SeriesNodePickMatch | undefined;
    private legendItemSymbol;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[];
    private getDatumId;
    computeLabelsBBox(): null;
    protected getStackId(): string;
    protected hasItemStylers(): boolean;
}
export {};
