import type { AgColorType, AgConeFunnelSeriesLabelFormatterParams, AgConeFunnelSeriesOptions, AgConeFunnelSeriesTooltipRendererParams } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';
import type { BaseFunnelProperties } from '../funnel/baseFunnelSeriesProperties';
declare const Label: typeof _ModuleSupport.Label, AbstractBarSeriesProperties: typeof _ModuleSupport.AbstractBarSeriesProperties, AxisLabel: typeof _ModuleSupport.AxisLabel;
declare class ConeFunnelSeriesLabel extends Label<AgConeFunnelSeriesLabelFormatterParams> {
    placement: string | undefined;
    spacing: number;
}
declare class ConeFunnelSeriesStageLabel extends AxisLabel {
    placement?: string;
}
export declare class ConeFunnelProperties extends AbstractBarSeriesProperties<AgConeFunnelSeriesOptions> implements BaseFunnelProperties<AgConeFunnelSeriesOptions> {
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
    readonly label: ConeFunnelSeriesLabel;
    readonly stageLabel: ConeFunnelSeriesStageLabel;
    readonly tooltip: _ModuleSupport.SeriesTooltip<Omit<AgConeFunnelSeriesTooltipRendererParams<unknown, unknown>, "context">>;
}
export {};
