import type { AgTreemapSeriesItemStylerParams, AgTreemapSeriesLabelFormatterParams, AgTreemapSeriesOptions, AgTreemapSeriesStyle, AgTreemapSeriesTooltipRendererParams, Styler, TextAlign, VerticalAlign } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
import { AutoSizedLabel, AutoSizedSecondaryLabel } from '../util/autoSizedLabel';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties, HierarchySeriesProperties: typeof _ModuleSupport.HierarchySeriesProperties, HighlightStyle: typeof _ModuleSupport.HighlightStyle, Label: typeof _ModuleSupport.Label;
declare class TreemapGroupLabel extends Label<AgTreemapSeriesLabelFormatterParams> {
    spacing: number;
}
declare class TreemapSeriesGroup extends BaseProperties {
    fill: InternalAgColorType | undefined;
    fillOpacity: number;
    stroke?: string;
    strokeWidth: number;
    strokeOpacity: number;
    cornerRadius: number;
    textAlign: TextAlign;
    gap: number;
    padding: number;
    interactive: boolean;
    readonly label: TreemapGroupLabel;
}
declare class TreemapSeriesTile extends BaseProperties {
    fill: InternalAgColorType | undefined;
    fillOpacity: number;
    stroke?: string;
    strokeWidth: number;
    strokeOpacity: number;
    cornerRadius: number;
    textAlign: TextAlign;
    verticalAlign: VerticalAlign;
    gap: number;
    padding: number;
    readonly label: AutoSizedLabel<AgTreemapSeriesLabelFormatterParams<any>>;
    readonly secondaryLabel: AutoSizedSecondaryLabel<AgTreemapSeriesLabelFormatterParams<any>>;
}
declare class TreemapSeriesGroupHighlightStyle extends BaseProperties {
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    readonly label: AutoSizedLabel<AgTreemapSeriesLabelFormatterParams<any>>;
}
declare class TreemapSeriesTileHighlightStyle extends BaseProperties {
    fill?: string;
    fillOpacity?: number;
    stroke?: string;
    strokeWidth?: number;
    strokeOpacity?: number;
    readonly label: AutoSizedLabel<AgTreemapSeriesLabelFormatterParams<any>>;
    readonly secondaryLabel: AutoSizedSecondaryLabel<AgTreemapSeriesLabelFormatterParams<any>>;
}
declare class TreemapSeriesHighlightStyle extends HighlightStyle {
    constructor();
    readonly group: TreemapSeriesGroupHighlightStyle;
    readonly tile: TreemapSeriesTileHighlightStyle;
    getStyle(isLeaf: boolean): TreemapSeriesGroupHighlightStyle | TreemapSeriesTileHighlightStyle;
}
export declare class TreemapSeriesProperties extends HierarchySeriesProperties<AgTreemapSeriesOptions> {
    sizeName?: string;
    labelKey?: string;
    secondaryLabelKey?: string;
    itemStyler?: Styler<AgTreemapSeriesItemStylerParams<unknown>, AgTreemapSeriesStyle>;
    readonly highlightStyle: TreemapSeriesHighlightStyle;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgTreemapSeriesTooltipRendererParams<any, unknown>, "context">>;
    readonly group: TreemapSeriesGroup;
    readonly tile: TreemapSeriesTile;
    undocumentedGroupFills: string[];
    undocumentedGroupStrokes: string[];
    getStyle(isLeaf: boolean, fills: InternalAgColorType[], strokes: string[], index: number): Required<AgTreemapSeriesStyle> & {
        opacity: number;
    };
}
export {};
