import { type AgBoxPlotSeriesOptions, _ModuleSupport } from 'ag-charts-community';
import { BoxPlotGroup } from './boxPlotGroup';
import { BoxPlotSeriesProperties } from './boxPlotSeriesProperties';
import type { BoxPlotNodeDatum } from './boxPlotTypes';
declare class BoxPlotSeriesNodeEvent<TEvent extends string = _ModuleSupport.SeriesNodeEventTypes> extends _ModuleSupport.SeriesNodeEvent<BoxPlotNodeDatum, TEvent> {
    readonly xKey?: string;
    readonly minKey?: string;
    readonly q1Key?: string;
    readonly medianKey?: string;
    readonly q3Key?: string;
    readonly maxKey?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: BoxPlotNodeDatum, series: BoxPlotSeries);
}
export declare class BoxPlotSeries extends _ModuleSupport.AbstractBarSeries<BoxPlotGroup, AgBoxPlotSeriesOptions, BoxPlotSeriesProperties, BoxPlotNodeDatum> {
    static readonly className = "BoxPlotSeries";
    static readonly type: "box-plot";
    properties: BoxPlotSeriesProperties;
    protected readonly NodeEvent: typeof BoxPlotSeriesNodeEvent;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[];
    getSeriesRange(_direction: _ModuleSupport.ChartAxisDirection, visibleRange: [any, any]): any[];
    createNodeData(): {
        itemId: string;
        nodeData: BoxPlotNodeDatum[];
        labelData: never[];
        scales: {
            x?: _ModuleSupport.Scaling | undefined;
            y?: _ModuleSupport.Scaling | undefined;
            angle?: _ModuleSupport.Scaling | undefined;
            radius?: _ModuleSupport.Scaling | undefined;
        };
        groupScale: _ModuleSupport.Scaling | undefined;
        visible: boolean;
    } | undefined;
    private legendItemSymbol;
    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[];
    getTooltipContent(datumIndex: number): _ModuleSupport.TooltipContent | undefined;
    protected animateEmptyUpdateReady({ datumSelection, }: _ModuleSupport.CartesianAnimationData<BoxPlotGroup, BoxPlotNodeDatum>): void;
    protected isLabelEnabled(): boolean;
    protected updateDatumSelection(opts: {
        nodeData: BoxPlotNodeDatum[];
        datumSelection: _ModuleSupport.Selection<BoxPlotGroup, BoxPlotNodeDatum>;
        seriesIdx: number;
    }): _ModuleSupport.Selection<BoxPlotGroup, BoxPlotNodeDatum>;
    private getItemStyle;
    protected updateDatumNodes({ datumSelection, isHighlight, }: {
        datumSelection: _ModuleSupport.Selection<BoxPlotGroup, BoxPlotNodeDatum>;
        isHighlight: boolean;
    }): void;
    protected updateLabelNodes(): void;
    protected updateLabelSelection(opts: {
        labelData: BoxPlotNodeDatum[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, BoxPlotNodeDatum>;
        seriesIdx: number;
    }): _ModuleSupport.Selection<_ModuleSupport.Text<any>, BoxPlotNodeDatum>;
    protected nodeFactory(): BoxPlotGroup;
    protected computeFocusBounds({ datumIndex }: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined;
    protected hasItemStylers(): boolean;
}
export {};
