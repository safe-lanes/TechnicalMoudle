import type { AgColorType, AgFunnelSeriesItemStylerParams, AgFunnelSeriesLabelFormatterParams, AgFunnelSeriesOptions, AgFunnelSeriesStyle, AgFunnelSeriesTooltipRendererParams, Styler } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { InternalAgColorType } from 'ag-charts-core';
import type { BaseFunnelProperties } from './baseFunnelSeriesProperties';
declare const Label: typeof _ModuleSupport.Label, AbstractBarSeriesProperties: typeof _ModuleSupport.AbstractBarSeriesProperties, BaseProperties: typeof _ModuleSupport.BaseProperties, AxisLabel: typeof _ModuleSupport.AxisLabel;
declare class FunnelSeriesLabel extends Label<AgFunnelSeriesLabelFormatterParams> {
}
declare class FunnelSeriesStageLabel extends AxisLabel {
    placement?: string;
}
declare class FunnelDropOff extends BaseProperties {
    enabled: boolean;
    fill: InternalAgColorType | undefined;
    fillOpacity: number;
    stroke: string | undefined;
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
}
export declare class FunnelProperties extends AbstractBarSeriesProperties<AgFunnelSeriesOptions> implements BaseFunnelProperties<AgFunnelSeriesOptions> {
    stageKey: string;
    valueKey: string;
    fills: AgColorType[];
    readonly fillGradientDefaults: _ModuleSupport.FillGradientDefaults;
    readonly fillPatternDefaults: _ModuleSupport.FillPatternDefaults;
    readonly fillImageDefaults: _ModuleSupport.FillImageDefaults;
    fillOpacity: number;
    strokes: string[];
    strokeWidth: number;
    strokeOpacity: number;
    lineDash: number[];
    lineDashOffset: number;
    spacingRatio: number;
    itemStyler?: Styler<AgFunnelSeriesItemStylerParams<unknown>, AgFunnelSeriesStyle>;
    readonly dropOff: FunnelDropOff;
    readonly shadow: _ModuleSupport.DropShadow;
    readonly label: FunnelSeriesLabel;
    readonly stageLabel: FunnelSeriesStageLabel;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgFunnelSeriesTooltipRendererParams<unknown, unknown>, "context">>;
    getStyle(index: number): Required<AgFunnelSeriesStyle> & {
        opacity: number;
    };
}
export {};
