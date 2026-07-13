import { _ModuleSupport } from 'ag-charts-community';
declare const Chart: typeof _ModuleSupport.Chart;
export declare class StandaloneChart extends Chart {
    static readonly className = "StandaloneChart";
    static readonly type: "standalone";
    getChartType(): "standalone";
    protected performLayout(ctx: _ModuleSupport.LayoutContext): void;
    protected getAriaLabel(): string;
}
export {};
