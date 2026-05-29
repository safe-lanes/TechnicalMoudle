import type { AgCandlestickSeriesItemOptions, AgCandlestickSeriesItemStylerParams, AgCandlestickSeriesTooltipRendererParams, AgOhlcSeriesBaseOptions, AgOhlcSeriesItemOptions, AgOhlcSeriesItemStylerParams, AgOhlcSeriesOptions, AgOhlcSeriesTooltipRendererParams, FillOptions, LineDashOptions, StrokeOptions, Styler } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { RequiredInternalAgGradientColor, RequiredInternalAgImageFill, RequiredInternalAgPatternColor } from 'ag-charts-core';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties, AbstractBarSeriesProperties: typeof _ModuleSupport.AbstractBarSeriesProperties;
declare class OhlcSeriesItem extends BaseProperties {
    stroke: string;
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
}
declare class OhlcSeriesItems extends BaseProperties {
    readonly up: OhlcSeriesItem;
    readonly down: OhlcSeriesItem;
}
export declare abstract class OhlcSeriesBaseProperties<T extends AgOhlcSeriesBaseOptions> extends AbstractBarSeriesProperties<T> {
    abstract item: Record<'up' | 'down', FillOptions & StrokeOptions & LineDashOptions & {
        fillGradientDefaults?: RequiredInternalAgGradientColor;
        fillPatternDefaults?: RequiredInternalAgPatternColor;
        fillImageDefaults?: RequiredInternalAgImageFill;
    }>;
    xKey: string;
    openKey: string;
    closeKey: string;
    highKey: string;
    lowKey: string;
    xName?: string;
    yName?: string;
    openName?: string;
    closeName?: string;
    highName?: string;
    lowName?: string;
    abstract readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgOhlcSeriesTooltipRendererParams<any> & AgCandlestickSeriesTooltipRendererParams<any>, 'context'>>;
    abstract itemStyler?: Styler<AgOhlcSeriesItemStylerParams<unknown>, AgOhlcSeriesItemOptions> & Styler<AgCandlestickSeriesItemStylerParams<unknown>, AgCandlestickSeriesItemOptions>;
    abstract getStyle(itemId: 'up' | 'down'): (Required<AgOhlcSeriesItemOptions> & {
        opacity: number;
    }) | (Required<AgCandlestickSeriesItemOptions> & {
        opacity: number;
    });
}
export declare class OhlcSeriesProperties extends OhlcSeriesBaseProperties<AgOhlcSeriesOptions> {
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgOhlcSeriesTooltipRendererParams<any, unknown>, "context">>;
    readonly item: OhlcSeriesItems;
    itemStyler?: Styler<AgOhlcSeriesItemStylerParams<unknown>, AgOhlcSeriesItemOptions>;
    getStyle(itemId: 'up' | 'down'): Required<AgOhlcSeriesItemOptions> & {
        opacity: number;
    };
}
export {};
