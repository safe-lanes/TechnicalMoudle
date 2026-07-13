import { _ModuleSupport } from 'ag-charts-community';
import type { AgChartLegendPlacement } from 'ag-charts-types';
interface TickDatum {
    tick: any;
    tickId: string;
    tickLabel: string;
    translation: number;
}
interface DataProvider {
    data: _ModuleSupport.GradientLegendDatum[];
}
export declare class AxisTicks implements _ModuleSupport.TickGenerationAxis<any, any> {
    private readonly ctx;
    private readonly dataProvider;
    static readonly DefaultTickCount = 5;
    static readonly DefaultMinSpacing = 10;
    readonly id: string;
    protected readonly axisGroup: _ModuleSupport.TranslatableGroup;
    protected readonly labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text<any>, TickDatum>;
    readonly interval: _ModuleSupport.AxisInterval<unknown>;
    readonly label: _ModuleSupport.AxisLabel;
    readonly scale: _ModuleSupport.LinearScale;
    placement: AgChartLegendPlacement;
    translationX: number;
    translationY: number;
    constructor(ctx: _ModuleSupport.ModuleContext, dataProvider: DataProvider);
    private get horizontal();
    attachAxis(axisNode: _ModuleSupport.Group): void;
    calculateLayout(): _ModuleSupport.BBox | undefined;
    tickFormatter(domain: number[], _ticks: number[], _primary: boolean, fractionDigits?: number): (value: any, index: number) => string | undefined;
    inRange(x: number, tolerance?: number): boolean;
    padding: number;
    private generateTicks;
    private getTicksData;
}
export {};
