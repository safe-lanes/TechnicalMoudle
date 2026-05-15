import type { AgSunburstSeriesItemStylerParams, AgSunburstSeriesLabelFormatterParams, AgSunburstSeriesOptions, AgSunburstSeriesStyle, AgSunburstSeriesTooltipRendererParams, Styler } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import { AutoSizedLabel, AutoSizedSecondaryLabel } from '../util/autoSizedLabel';
declare const HierarchySeriesProperties: typeof _ModuleSupport.HierarchySeriesProperties, HighlightStyle: typeof _ModuleSupport.HighlightStyle;
declare class SunburstSeriesTileHighlightStyle extends HighlightStyle {
    constructor();
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    readonly label: AutoSizedLabel<AgSunburstSeriesLabelFormatterParams<any>>;
    readonly secondaryLabel: AutoSizedLabel<AgSunburstSeriesLabelFormatterParams<any>>;
}
export declare class SunburstSeriesProperties extends HierarchySeriesProperties<AgSunburstSeriesOptions> {
    sizeName?: string;
    labelKey?: string;
    secondaryLabelKey?: string;
    fillOpacity: number;
    strokeWidth: number;
    strokeOpacity: number;
    cornerRadius: number;
    sectorSpacing?: number;
    padding?: number;
    itemStyler?: Styler<AgSunburstSeriesItemStylerParams<unknown>, AgSunburstSeriesStyle>;
    highlightStyle: SunburstSeriesTileHighlightStyle;
    readonly label: AutoSizedLabel<AgSunburstSeriesLabelFormatterParams<any>>;
    readonly secondaryLabel: AutoSizedSecondaryLabel<AgSunburstSeriesLabelFormatterParams<any>>;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgSunburstSeriesTooltipRendererParams<any, unknown>, "context">>;
    getStyle(index: number): Required<AgSunburstSeriesStyle> & {
        opacity: number;
    };
}
export {};
