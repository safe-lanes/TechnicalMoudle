import type { AgTooltipRendererResult, AgWaterfallSeriesItemStylerParams, AgWaterfallSeriesItemType, AgWaterfallSeriesLabelFormatterParams, AgWaterfallSeriesLabelPlacement, AgWaterfallSeriesOptions, AgWaterfallSeriesStyle, AgWaterfallSeriesTooltipRendererParams, PixelSize, Styler } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
declare const AbstractBarSeriesProperties: typeof _ModuleSupport.AbstractBarSeriesProperties, BaseProperties: typeof _ModuleSupport.BaseProperties, Label: typeof _ModuleSupport.Label;
export declare class WaterfallSeriesTotal extends BaseProperties {
    totalType: 'subtotal' | 'total';
    index: number;
    axisLabel: string;
}
declare class WaterfallSeriesItemTooltip extends BaseProperties {
    renderer?: (params: AgWaterfallSeriesTooltipRendererParams) => string | AgTooltipRendererResult;
}
declare class WaterfallSeriesLabel extends Label<AgWaterfallSeriesLabelFormatterParams> {
    placement: AgWaterfallSeriesLabelPlacement;
    spacing: PixelSize;
}
export declare class WaterfallSeriesItem extends BaseProperties {
    name?: string;
    fill: InternalAgColorType;
    readonly fillGradientDefaults: _ModuleSupport.FillGradientDefaults;
    readonly fillPatternDefaults: _ModuleSupport.FillPatternDefaults;
    readonly fillImageDefaults: _ModuleSupport.FillImageDefaults;
    stroke: string;
    fillOpacity: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
    strokeWidth: number;
    cornerRadius: number;
    itemStyler?: Styler<AgWaterfallSeriesItemStylerParams<unknown>, AgWaterfallSeriesStyle>;
    readonly shadow: _ModuleSupport.DropShadow;
    readonly label: WaterfallSeriesLabel;
    readonly tooltip: WaterfallSeriesItemTooltip;
}
declare class WaterfallSeriesConnectorLine extends BaseProperties {
    enabled: boolean;
    stroke: string;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
    strokeWidth: number;
}
declare class WaterfallSeriesItems extends BaseProperties {
    readonly positive: WaterfallSeriesItem;
    readonly negative: WaterfallSeriesItem;
    readonly total: WaterfallSeriesItem;
}
export declare class WaterfallSeriesProperties extends AbstractBarSeriesProperties<AgWaterfallSeriesOptions> {
    xKey: string;
    yKey: string;
    xName?: string;
    yName?: string;
    readonly item: WaterfallSeriesItems;
    readonly totals: WaterfallSeriesTotal[];
    readonly line: WaterfallSeriesConnectorLine;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgWaterfallSeriesTooltipRendererParams<any, unknown>, "context">>;
    getStyle(itemId: AgWaterfallSeriesItemType): Required<AgWaterfallSeriesStyle> & {
        opacity: number;
    };
}
export {};
