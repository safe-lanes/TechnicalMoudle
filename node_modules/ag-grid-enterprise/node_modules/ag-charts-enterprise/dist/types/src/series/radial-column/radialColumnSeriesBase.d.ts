import type { AgBaseRadialColumnSeriesOptions, AgRadialSeriesStyle } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { RadialColumnSeriesBaseProperties } from './radialColumnSeriesBaseProperties';
declare class RadialColumnSeriesNodeEvent<TEvent extends string = _ModuleSupport.SeriesNodeEventTypes> extends _ModuleSupport.SeriesNodeEvent<RadialColumnNodeDatum, TEvent> {
    readonly angleKey?: string;
    readonly radiusKey?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: RadialColumnNodeDatum, series: RadialColumnSeriesBase<any>);
}
interface RadialColumnLabelNodeDatum {
    text: string;
    x: number;
    y: number;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
}
export interface RadialColumnNodeDatum extends _ModuleSupport.DataModelSeriesNodeDatum {
    readonly label?: RadialColumnLabelNodeDatum;
    readonly angleValue: any;
    readonly radiusValue: any;
    readonly negative: boolean;
    readonly innerRadius: number;
    readonly outerRadius: number;
    readonly stackInnerRadius: number;
    readonly stackOuterRadius: number;
    readonly startAngle: number;
    readonly endAngle: number;
    readonly midAngle: number;
    readonly axisInnerRadius: number;
    readonly axisOuterRadius: number;
    readonly columnWidth: number;
    readonly index: number;
}
export declare abstract class RadialColumnSeriesBase<ItemPathType extends _ModuleSupport.Sector | _ModuleSupport.RadialColumnShape> extends _ModuleSupport.PolarSeries<RadialColumnNodeDatum, AgBaseRadialColumnSeriesOptions, RadialColumnSeriesBaseProperties<AgBaseRadialColumnSeriesOptions>, ItemPathType> {
    protected readonly NodeEvent: typeof RadialColumnSeriesNodeEvent;
    private readonly groupScale;
    constructor(moduleCtx: _ModuleSupport.ModuleContext, { animationResetFns, }: {
        animationResetFns?: {
            item?: (node: ItemPathType, datum: RadialColumnNodeDatum) => _ModuleSupport.AnimationValue & Partial<ItemPathType>;
        };
    });
    getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[];
    protected abstract getStackId(): string;
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    protected circleCache: {
        r: number;
        cx: number;
        cy: number;
    };
    protected didCircleChange(): boolean;
    protected isRadiusAxisReversed(): boolean | undefined;
    maybeRefreshNodeData(): void;
    protected getAxisInnerRadius(): number;
    createNodeData(): {
        itemId: string;
        nodeData: RadialColumnNodeDatum[];
        labelData: RadialColumnNodeDatum[];
    } | undefined;
    protected getColumnWidth(_startAngle: number, _endAngle: number): number;
    update({ seriesRect }: {
        seriesRect?: _ModuleSupport.BBox;
    }): void;
    protected abstract updateItemPath(node: ItemPathType, datum: RadialColumnNodeDatum, highlight: boolean): void;
    protected getItemStyle(nodeDatum: RadialColumnNodeDatum, isHighlight: boolean): Required<AgRadialSeriesStyle>;
    protected updateSectorSelection(selection: _ModuleSupport.Selection<ItemPathType, RadialColumnNodeDatum>, isHighlight: boolean): void;
    protected updateLabels(): void;
    protected abstract getColumnTransitionFunctions(): {
        fromFn: _ModuleSupport.FromToMotionPropFn<any, any, any>;
        toFn: _ModuleSupport.FromToMotionPropFn<any, any, any>;
    };
    protected animateEmptyUpdateReady(): void;
    animateClearingUpdateEmpty(): void;
    getTooltipContent(datumIndex: number): _ModuleSupport.TooltipContent | undefined;
    protected pickNodeClosestDatum(point: _ModuleSupport.Point): _ModuleSupport.SeriesNodePickMatch | undefined;
    private legendItemSymbol;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[];
    private getDatumId;
    computeLabelsBBox(): null;
}
export {};
