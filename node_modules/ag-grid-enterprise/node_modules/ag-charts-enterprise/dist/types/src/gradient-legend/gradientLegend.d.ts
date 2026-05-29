import { type AgChartLegendPosition, type AgGradientLegendOptions, type AgGradientLegendScaleOptions, type Padding, _ModuleSupport } from 'ag-charts-community';
import { AxisTicks } from './axisTicks';
declare const BaseProperties: typeof _ModuleSupport.BaseProperties;
declare class GradientBar extends BaseProperties {
    thickness: number;
    preferredLength: number;
}
declare class GradientLegendScale extends _ModuleSupport.BaseProperties<AgGradientLegendScaleOptions> implements Omit<AgGradientLegendScaleOptions, 'label'> {
    protected axisTicks: AxisTicks;
    constructor(axisTicks: AxisTicks);
    label: _ModuleSupport.AxisLabel;
    interval: _ModuleSupport.AxisInterval<number>;
    padding?: AxisTicks['padding'];
}
export declare class GradientLegend extends _ModuleSupport.BaseProperties<AgGradientLegendOptions> {
    readonly ctx: _ModuleSupport.ModuleContext;
    static readonly className = "GradientLegend";
    readonly id: string;
    private readonly axisTicks;
    private readonly highlightManager;
    private readonly legendGroup;
    private readonly containerNode;
    private readonly gradientRect;
    private readonly arrow;
    private readonly ticksGroup;
    private readonly cleanup;
    enabled: boolean;
    position: AgChartLegendPosition;
    reverseOrder: boolean;
    readonly gradient: GradientBar;
    private isVertical;
    /**
     * Spacing between the legend and the edge of the chart's element.
     */
    spacing: number;
    border: _ModuleSupport.Border;
    cornerRadius: number;
    fill?: string;
    fillOpacity: number;
    padding: Padding;
    scale: GradientLegendScale;
    data: _ModuleSupport.GradientLegendDatum[];
    constructor(ctx: _ModuleSupport.ModuleContext);
    destroy(): void;
    attachLegend(scene: _ModuleSupport.Scene): void;
    private onStartLayout;
    private normalizeColorArrays;
    private updateGradientRect;
    private updateAxis;
    private updateContainer;
    private updateArrow;
    private getMeasurements;
    private getContainerStyles;
    private onChartHoverChange;
}
export {};
