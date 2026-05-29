import type { AgCandlestickSeriesItemOptions, AgCandlestickSeriesItemStylerParams, AgCandlestickSeriesTooltipRendererParams, AgOhlcSeriesBaseOptions, Styler } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
import { OhlcSeriesBaseProperties } from '../ohlc/ohlcSeriesProperties';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties;
declare class CandlestickSeriesWick extends BaseProperties {
    stroke?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    lineDash?: number[];
    lineDashOffset?: number;
}
declare class CandlestickSeriesItem extends BaseProperties {
    fill: InternalAgColorType;
    readonly fillGradientDefaults: _ModuleSupport.FillGradientDefaults;
    readonly fillPatternDefaults: _ModuleSupport.FillPatternDefaults;
    readonly fillImageDefaults: _ModuleSupport.FillImageDefaults;
    fillOpacity: number;
    stroke: string;
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
    cornerRadius: number;
    readonly wick: CandlestickSeriesWick;
}
declare class CandlestickSeriesItems extends BaseProperties {
    readonly up: CandlestickSeriesItem;
    readonly down: CandlestickSeriesItem;
}
export declare class CandlestickSeriesProperties<T extends AgOhlcSeriesBaseOptions> extends OhlcSeriesBaseProperties<T> {
    readonly item: CandlestickSeriesItems;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgCandlestickSeriesTooltipRendererParams<any, unknown>, "context">>;
    itemStyler?: Styler<AgCandlestickSeriesItemStylerParams<unknown>, AgCandlestickSeriesItemOptions>;
    constructor();
    getStyle(itemId: 'up' | 'down'): Required<AgCandlestickSeriesItemOptions> & {
        opacity: number;
    };
}
export {};
