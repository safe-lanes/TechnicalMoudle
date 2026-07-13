import { type AgOhlcSeriesBaseOptions, type AgOhlcSeriesItemType, type FillOptions, type LineDashOptions, type StrokeOptions, _ModuleSupport } from 'ag-charts-community';
import type { OhlcBaseNode } from './ohlcNode';
import type { OhlcSeriesBaseProperties } from './ohlcSeriesProperties';
export interface OhlcNodeDatum extends Omit<_ModuleSupport.CartesianSeriesNodeDatum, 'yKey' | 'yValue'> {
    readonly itemId: AgOhlcSeriesItemType;
    readonly openValue: number;
    readonly closeValue: number;
    readonly highValue?: number;
    readonly lowValue?: number;
    readonly aggregatedValue: number;
    readonly isRising: boolean;
    readonly centerX: number;
    readonly width: number;
    readonly y: number;
    readonly height: number;
    readonly yOpen: number;
    readonly yClose: number;
    readonly crisp: boolean;
}
declare class OhlcSeriesNodeEvent<TEvent extends string = _ModuleSupport.SeriesNodeEventTypes> extends _ModuleSupport.SeriesNodeEvent<OhlcNodeDatum, TEvent> {
    readonly xKey?: string;
    readonly openKey?: string;
    readonly closeKey?: string;
    readonly highKey?: string;
    readonly lowKey?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: OhlcNodeDatum, series: OhlcSeriesBase<OhlcBaseNode, AgOhlcSeriesBaseOptions, any>);
}
export declare abstract class OhlcSeriesBase<TNode extends OhlcBaseNode, TOpts extends AgOhlcSeriesBaseOptions, TProps extends OhlcSeriesBaseProperties<TOpts>> extends _ModuleSupport.AbstractBarSeries<TNode, TOpts, TProps, OhlcNodeDatum> {
    protected readonly NodeEvent: typeof OhlcSeriesNodeEvent;
    private dataAggregationFilters;
    constructor(moduleCtx: _ModuleSupport.ModuleContext);
    processData(dataController: _ModuleSupport.DataController): Promise<void>;
    private aggregateData;
    getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[];
    getSeriesRange(_direction: _ModuleSupport.ChartAxisDirection, visibleRange: [any, any]): any[];
    getVisibleItems(xVisibleRange: [number, number], yVisibleRange: [number, number] | undefined, minVisibleItems: number): number;
    createNodeData(): {
        itemId: string;
        nodeData: OhlcNodeDatum[];
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
    protected isVertical(): boolean;
    protected isLabelEnabled(): boolean;
    protected updateDatumSelection(opts: {
        nodeData: OhlcNodeDatum[];
        datumSelection: _ModuleSupport.Selection<TNode, OhlcNodeDatum>;
        seriesIdx: number;
    }): _ModuleSupport.Selection<TNode, OhlcNodeDatum>;
    protected updateLabelNodes(_opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, OhlcNodeDatum>;
        seriesIdx: number;
    }): void;
    protected updateLabelSelection(opts: {
        labelData: OhlcNodeDatum[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, OhlcNodeDatum>;
        seriesIdx: number;
    }): _ModuleSupport.Selection<_ModuleSupport.Text<any>, OhlcNodeDatum>;
    protected getItemStyle({ datumIndex, itemId, datum, xValue }: Partial<OhlcNodeDatum>, isHighlight: boolean): Required<import("ag-charts-community").AgOhlcSeriesItemOptions> & {
        opacity: number;
    } & Required<import("ag-charts-community").AgCandlestickSeriesItemOptions> & {
        opacity: number;
    } & FillOptions & StrokeOptions & LineDashOptions & {
        opacity?: number | undefined;
    };
    getTooltipContent(datumIndex: number): _ModuleSupport.TooltipContent | undefined;
    computeFocusBounds(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined;
}
export {};
